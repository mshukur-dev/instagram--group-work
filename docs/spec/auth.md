# Авторизация

Требования: `AUTH-1`…`AUTH-7` в [TZ.md](../TZ.md).

## 1. Токены

| Токен | Срок жизни | Где хранится | Для чего |
|---|---|---|---|
| **access** | 15 минут | httpOnly cookie `access_token`, `path=/` | Подтверждает личность в каждом запросе |
| **refresh** | 30 дней | httpOnly cookie `refresh_token`, `path=/api/auth` | Получение нового access, когда старый истёк |
| **socket** | 1 минута | память фронтенда | Одноразовый вход в Socket.IO (см. [realtime.md](./realtime.md)) |

Параметры cookies: `httpOnly`, `sameSite=lax`, `secure` в продакшене.

**Почему httpOnly cookies, а не localStorage:** JavaScript на странице не может прочитать httpOnly cookie, поэтому даже при XSS-уязвимости токен не украдут.

**Почему два токена:** access живёт недолго — если его перехватят, он скоро станет бесполезен. Refresh живёт долго, но отправляется только на `/api/auth/*` и хранится в БД, поэтому его можно отозвать (выход из аккаунта).

## 2. Сессии и ротация refresh-токена

Каждый вход создаёт запись `Session` в БД (см. [database.md](./database.md)). В БД хранится **хеш** refresh-токена, а не сам токен.

При `POST /api/auth/refresh`:
1. Берём `refresh_token` из cookie, проверяем подпись JWT.
2. Находим `Session` по `sessionId` из payload, сравниваем хеш.
3. Выдаём **новые** access и refresh, обновляем хеш в `Session` (ротация).
4. Если хеш не совпал (кто-то использует старый токен) — удаляем сессию, возвращаем 401.

При выходе (`POST /api/auth/logout`) сессия удаляется, cookies очищаются, push-подписка этого браузера удаляется.

Список сессий показывается в настройках («Where you're logged in», `SETTINGS-5`). Удаление чужой сессии = выход на том устройстве: его refresh перестанет работать, и не позже чем через 15 минут (срок access) оно разлогинится.

Payload access-токена: `{ sub: userId, username }`. Payload refresh-токена: `{ sub: userId, sessionId }`.

## 3. Регистрация и вход по паролю

- Пароль хешируется **argon2** перед сохранением. В ответах API пароль и хеш не возвращаются никогда.
- Вход: поле `login` принимает email **или** username. Ошибка одинаковая для «нет пользователя» и «неверный пароль»: `Incorrect username or password.`
- После успешной регистрации пользователь сразу авторизован (cookies ставятся в ответе).

## 4. Вход через Google

Используется `passport-google-oauth20`.

```
1. Фронт: кнопка «Войти через Google» → переход на /api/auth/google
2. API редиректит на страницу согласия Google
3. Google возвращает на /api/auth/google/callback?code=...
4. API получает профиль Google (googleId, email, имя, аватар):
   - есть пользователь с этим googleId → вход
   - есть пользователь с этим email → привязываем googleId, вход
   - никого нет → создаём пользователя, username генерируется из email
     (ivan.petrov → ivan.petrov, если занят → ivan.petrov_4821)
5. API ставит cookies и редиректит на WEB_URL (или на /accounts/onboarding
   для нового пользователя, где можно сменить сгенерированный username)
```

У пользователя, созданного через Google, `passwordHash = null`. Войти по паролю он сможет, только если задаст пароль в настройках.

**Почему callback идёт через домен фронта** (`localhost:3000/api/auth/google/callback`): так cookies ставятся на домен фронтенда и работают с прокси (см. [architecture.md](./architecture.md#4-как-фронтенд-общается-с-бэкендом)).

Настройка в Google Cloud Console: OAuth Client (Web application), Authorized redirect URI = значение `GOOGLE_CALLBACK_URL` (локальное и продакшен).

## 5. Защита эндпоинтов в NestJS

- `JwtAuthGuard` подключён **глобально**: по умолчанию все эндпоинты требуют авторизации.
- Публичные эндпоинты помечаются декоратором `@Public()` (регистрация, вход, refresh, Google).
- Текущий пользователь достаётся декоратором `@CurrentUser()`:

```ts
@Get('me')
getMe(@CurrentUser() user: AuthUser) {
  return this.usersService.getMe(user.id);
}
```

## 6. Автообновление токена на фронтенде

Axios interceptor (см. [frontend.md](./frontend.md)):
1. Ответ 401 → вызываем `POST /api/auth/refresh` **один раз** (параллельные запросы ждут тот же промис).
2. Успех → повторяем исходный запрос.
3. Неудача → очищаем кэш TanStack Query и отправляем на `/accounts/login`.

## 7. Защита страниц на фронтенде

`src/proxy.ts` в Next.js (бывший `middleware.ts`): если нет cookie `refresh_token` и страница не из списка публичных (`/accounts/login`, `/accounts/emailsignup`) — редирект на логин. Это только удобство для UX: настоящую защиту делает API.
