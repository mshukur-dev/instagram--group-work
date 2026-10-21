# Push-уведомления (Web Push)

Требования: `PUSH-1`…`PUSH-8`, `SETTINGS-2` в [TZ.md](../TZ.md).

## 1. Что это

Web Push — встроенная функция браузеров. Сайт регистрирует **Service Worker** — небольшой скрипт, который браузер держит в фоне даже при закрытой вкладке. Наш сервер отправляет уведомление в push-сервис браузера (у Chrome это сервера Google), тот доставляет его в браузер, Service Worker показывает системное уведомление.

Бесплатно, без Firebase и сторонних аккаунтов. Нужны только **VAPID-ключи** — пара ключей, которая подтверждает, что push отправил именно наш сервер. Генерируются один раз: `npx web-push generate-vapid-keys`.

Ограничения: нужен HTTPS (локально `localhost` разрешён), пользователь должен разрешить уведомления, браузер должен быть запущен.

## 2. Подписка

```
1. Пользователь нажимает «Turn on notifications» (баннер после первого действия или в настройках)
2. Фронт: Notification.requestPermission() → «Разрешить»
3. Фронт: регистрирует /sw.js, вызывает pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
   → браузер выдаёт { endpoint, keys: { p256dh, auth } }
4. Фронт: POST /api/push/subscriptions → API сохраняет PushSubscription
5. При выходе из аккаунта: DELETE /api/push/subscriptions { endpoint }
```

Один пользователь может иметь несколько подписок (ноутбук, второй браузер).

## 3. Когда отправлять: сайт открыт или нет

Главное правило — **не дублировать**. Решает сервер, `PushService.notify(userId, payload)`:

```
Есть активный сокет пользователя И вкладка в фокусе?
 ├─ да  → только Socket.IO-событие: уведомление внутри сайта + звук
 └─ нет → Socket.IO-событие (если сокет есть) + Web Push
```

Фронт сообщает фокус вкладки событием `presence:focus { focused: boolean }` (см. [realtime.md](./realtime.md)).

Перед отправкой проверяются настройки (`NotificationSettings`): `pushEnabled`, нужный тип (`messages`, `calls`…), `pausedUntil`.

## 4. Что отправляем

Текст push собирается **на языке получателя** (`User.language`) из словаря `push-messages.ts` — см. [i18n.md](./i18n.md#push-уведомления). Ниже примеры на английском.

| Событие | Заголовок | Текст | Клик / кнопки |
|---|---|---|---|
| Сообщение | `ivan` (или название группы) | `ivan: hey, how are you?` / `sent a photo` | Открыть `/direct/t/:id` |
| Входящий звонок | `Instagram` | `ivan is calling you…` / `ivan started a video call` (группа) | **Accept** → открыть сайт и подключиться; **Decline** → `POST /api/calls/:id/decline` |
| Лайк | `Instagram` | `ivan liked your post.` | Открыть пост |
| Комментарий | `Instagram` | `ivan commented: nice!` | Открыть пост |
| Подписка | `Instagram` | `ivan started following you.` | Открыть профиль |
| Запрос на подписку | `Instagram` | `ivan requested to follow you.` | Открыть запросы |

Payload (JSON, до 4 КБ):
```ts
type PushPayload = {
  type: 'MESSAGE' | 'CALL' | 'NOTIFICATION';
  title: string;
  body: string;
  icon: string;        // actor avatar
  url: string;         // where to go on click
  tag: string;         // same tag replaces previous: "conversation:<id>", "call:<id>"
  callId?: string;     // for Accept / Decline actions
};
```

`tag` важен: 5 сообщений из одной переписки дают одно обновляемое уведомление, а не пять.

## 5. Service Worker (`apps/web/public/sw.js`)

- `push` → `self.registration.showNotification(title, { body, icon, tag, data, actions })`. Для звонка: `actions: [{ action: 'accept' }, { action: 'decline' }]`, `requireInteraction: true` (не исчезает само).
- `notificationclick` →
  - `decline` → `fetch('/api/calls/:id/decline', { method: 'POST', credentials: 'include' })`
  - иначе → найти открытую вкладку сайта и перейти в ней на `url`, или открыть новую (`clients.openWindow`). Для `accept` — `url` = `/direct/t/:id?joinCall=<callId>`, страница сама подключается к звонку.
- Когда звонок закончился или его приняли на другом устройстве, сервер шлёт тихий push `{ type: 'CALL_ENDED', tag: 'call:<id>' }`, и SW закрывает уведомление о звонке.

## 6. Внутри сайта (вкладка активна)

- **Новое сообщение** не в открытой переписке → всплывающее уведомление (`sonner`) с аватаром и текстом + короткий звук.
- **Входящий звонок** → модальное окно с рингтоном (`useCallStore`, см. [calls.md](./calls.md)).
- **Заголовок вкладки:** `(N) Instagram`, где N — непрочитанные переписки + непрочитанные уведомления.

## 7. Бэкенд

- Библиотека `web-push`, модуль `push/`: `PushService.notify(userId, payload)`.
- Ответ `404` или `410` от push-сервиса = подписка больше не действует → удаляем `PushSubscription`.
- Отправка не блокирует основной запрос (вызывается после сохранения, без `await` в ответе пользователю).

## 8. Эндпоинты

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/push/vapid-public-key` | — | `{ key }` |
| POST | `/push/subscriptions` | `{ endpoint, keys: { p256dh, auth } }` | `204` |
| DELETE | `/push/subscriptions` | `{ endpoint }` | `204` |
