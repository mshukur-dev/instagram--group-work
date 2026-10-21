# Бэкенд (apps/api, NestJS)

## 1. Структура

```
apps/api/
├── prisma/
│   ├── schema.prisma          схема БД — см. database.md
│   ├── migrations/
│   └── seed.ts                тестовые пользователи, посты, подписки
└── src/
    ├── main.ts                запуск: prefix /api, cookie-parser, CORS, Swagger
    ├── app.module.ts
    ├── health.controller.ts   GET /api/health — проверка для деплоя
    ├── config/                env.ts (zod-проверка .env), AppConfigService
    ├── common/                общий код для всех модулей
    │   ├── decorators/        @Public(), @CurrentUser(), @ApiZodBody()
    │   ├── guards/            JwtAuthGuard (глобальный)
    │   ├── pipes/             ZodValidationPipe
    │   ├── errors/            AppException + badRequest/notFound/forbidden/conflict…
    │   ├── filters/           AllExceptionsFilter: любая ошибка → { statusCode, code, message }
    │   ├── types.ts           AuthUser
    │   └── pagination.ts      cursorArgs(), toPage(), toPageBy()
    ├── prisma/                PrismaModule + PrismaService
    └── modules/
        ├── auth/              регистрация, вход, Google, refresh, socket-token
        ├── users/             профиль, редактирование, поиск по username
        ├── follows/           подписки, запросы, блокировки
        ├── media/             подпись Cloudinary, удаление файлов
        ├── posts/             посты и Reels, лента, Explore, хэштеги
        ├── comments/          комментарии и ответы
        ├── likes/             лайки постов и комментариев, сохранения
        ├── search/            поиск пользователей и хэштегов, история
        ├── stories/           Stories, просмотры, Highlights
        ├── conversations/     переписки, участники групп
        ├── messages/          сообщения, реакции, прочтение
        ├── calls/             звонки, LiveKit-токены, вебхуки
        ├── notifications/     создание и выдача уведомлений
        ├── push/              Web Push: подписки, PushService.notify()
        ├── settings/          приватность, тема, настройки уведомлений, сессии
        └── realtime/          Socket.IO gateway, RealtimeService, онлайн-статус, фокус вкладки
```

## 2. Устройство модуля

Каждый модуль — это три слоя:

| Файл | Что делает | Чего НЕ делает |
|---|---|---|
| `*.controller.ts` | Принимает HTTP-запрос, валидирует, вызывает сервис, возвращает ответ | Не обращается к БД, не содержит бизнес-логики |
| `*.service.ts` | Вся логика: проверки прав, транзакции, вызовы других сервисов | Не знает про HTTP (`req`, `res`) |
| `*.mapper.ts` | Превращает объект Prisma в DTO ответа (`toPostDto`) | Не ходит в БД |

```ts
// posts.controller.ts
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiZodBody(createPostSchema) // shows the body in Swagger
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPostSchema)) dto: CreatePostInput,
  ): Promise<Post> {
    return this.postsService.create(user.id, dto);
  }

  @Get(':id/likes')
  likes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(filteredPageQuerySchema)) query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    return this.likesService.listLikers(user.id, id, query);
  }
}
```

## 2.1. Глобальные модули и контракты

Эти модули помечены `@Global()` — их сервисы можно внедрять в любой модуль без `imports`:

| Модуль | Сервис | Главные методы |
|---|---|---|
| `PrismaModule` | `PrismaService` | весь Prisma Client |
| `AppConfigModule` | `AppConfigService` | `get('WEB_URL')`, `isProduction`, `isGoogleEnabled`, `isCloudinaryEnabled`, `isPushEnabled` |
| `UsersModule` | `UserPreviewService` | `build(viewerId, rows)` → `Map<id, UserPreview>`, `buildOne`, `buildList`; `userPreviewSelect` для Prisma |
| `FollowsModule` | `FollowsService` | `canViewContent(viewer, owner)`, `isBlockedBetween`, `getBlockedUserIds`, `getFollowingIds`, `getFollowStatuses` |
| `RealtimeModule` | `RealtimeService` | `emitToUser`, `emitToUsers`, `isOnline`, `isFocused` |
| `NotificationsModule` | `NotificationsService` | `create(input)`, `remove(input)` |
| `PushModule` | `PushService` | `notify(userId, category, (language) => payload)` |

Обычные модули с экспортом для других: `PostsService.getByIds(viewerId, ids)` (нужен `MessagesModule`), `StoriesService.getByIds(viewerId, ids)` (нужен `MessagesModule`), `TokensService.verifySocket()` из `AuthModule` (нужен gateway).

**Сигнатуры этих методов — контракт.** Их можно реализовывать и расширять, но не менять, не обновив всех вызывающих.

## 3. Правила

1. **Валидация через zod** из `@instagram/shared` и `ZodValidationPipe`. `class-validator` не используем: схемы должны быть общими с фронтом.
2. **Каждый эндпоинт по умолчанию закрыт** (глобальный `JwtAuthGuard`). Открытые помечаются `@Public()`.
3. **Права проверяются в сервисе**: «это мой пост?», «я участник переписки?», «могу ли я видеть этот аккаунт?». Общая проверка видимости — `FollowsService.canViewContent(viewerId, ownerId)`.
4. **Никогда не возвращаем** `passwordHash`, `googleId`, `refreshTokenHash`, email чужих пользователей. Только через мапперы в DTO.
5. **Счётчики — в транзакции** с действием:
   ```ts
   await this.prisma.$transaction([
     this.prisma.like.create({ data: { userId, postId } }),
     this.prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }),
   ]);
   ```
6. **Повторный лайк/подписка не ошибка**: операции идемпотентны (повторный `POST /like` просто вернёт текущее состояние).
7. **Уведомления, realtime и push — побочные эффекты**: сервис сначала сохраняет основное действие, потом вызывает `NotificationsService.create(...)`, `RealtimeService.emit...` и `PushService.notify(...)` (не дожидаясь push в ответе). Себе уведомления не отправляются.
8. **N+1 запросов не допускаем**: флаги `isLiked`, `isSaved`, `followStatus` для списка постов получаем одним запросом (`where: { postId: { in: ids } }`), а не в цикле.
9. **Ошибки** — только через хелперы из `common/errors/app-exception.ts` с **кодом** из `ErrorCode` (`@instagram/shared`) и английским текстом: `throw conflict(ErrorCode.USERNAME_TAKEN, "This username isn't available.")`. Пользователю фронт показывает перевод по коду (см. [i18n.md](./i18n.md)). Новый код ошибки — сначала добавить в `ErrorCode`.
10. **Готовый текст не храним в БД** для уведомлений и системных сообщений — только тип и данные, текст собирает фронт на языке читателя. Исключение — push: его текст собирается на бэкенде по `User.language`.
11. **Rate limiting** (`@nestjs/throttler`) на вход, регистрацию и отправку сообщений.

## 4. Основные зависимости

`@nestjs/core`, `@nestjs/config`, `@nestjs/passport`, `passport-jwt`, `passport-google-oauth20`, `@nestjs/jwt`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/swagger`, `@nestjs/throttler`, `@nestjs/schedule`, `prisma`, `@prisma/client`, `argon2`, `cookie-parser`, `cloudinary`, `livekit-server-sdk`, `web-push`, `ua-parser-js` (браузер и ОС для списка сессий), `zod`.

## 5. Команды

```bash
pnpm --filter api dev                          # запуск в режиме разработки (порт 4000)
pnpm --filter api db:migrate --name x          # новая миграция после изменения схемы
pnpm --filter api db:studio                    # просмотр БД в браузере
pnpm --filter api db:seed                      # тестовые данные (стирает всё!)
pnpm --filter api test                         # unit-тесты (src/**/*.spec.ts)
pnpm --filter api test:e2e                     # e2e-тесты с настоящей БД (test/*.e2e-spec.ts)
```

**Тесты:** у каждого модуля — unit-тесты на логику прав и e2e-тест на основные эндпоинты (образец — `test/auth.e2e-spec.ts`). e2e-тесты сами создают своих пользователей с уникальными именами и удаляют их в конце.

## 6. Тестовые данные (seed)

`prisma/seed.ts` создаёт 10 пользователей (пароль у всех `password123`, например `alex.morgan`), подписки между ними, посты (в том числе карусели), Reels, Stories, лайки, комментарии, личную и групповую переписку. Картинки — `picsum.photos`, аватары — `pravatar.cc`. `emma.design` — приватный аккаунт.
