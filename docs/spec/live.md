# Прямой эфир (LIVE-*)

Эфир работает на том же LiveKit, что и звонки ([calls.md](./calls.md)): одна комната LiveKit на эфир, камеру и микрофон публикует только ведущий, зрители смотрят и слушают.

## 1. Данные

`LiveStream { id, hostId, roomName ("live_<uuid>"), status: LIVE | ENDED, startedAt, endedAt, hostLeftAt }`.

- У пользователя может быть только один эфир в статусе `LIVE`. Повторный `POST /lives` возвращает уже идущий эфир (например, после перезагрузки страницы ведущим).
- `hostLeftAt` заполнено, пока ведущий не подключён к комнате, в том числе до первого подключения. Раз в 10 с сервер завершает эфиры, где `hostLeftAt` старше `LIVE_HOST_GRACE_SECONDS` (60 с) — это LIVE-6.

## 2. API

| Метод | Путь | Ответ |
|---|---|---|
| POST | `/lives` | `LiveJoin` — начать эфир или вернуться в свой идущий |
| GET | `/lives` | `LiveStream[]` — идущие эфиры тех, на кого я подписан (и мой) — для колец LIVE |
| GET | `/users/:username/live` | `LiveStream`; `404 LIVE_NOT_FOUND`, если эфира нет |
| POST | `/lives/:id/join` | `LiveJoin`; `409 LIVE_ENDED`; `403 PRIVATE_ACCOUNT` |
| POST | `/lives/:id/end` | `204` — только ведущий, иначе `404 LIVE_NOT_FOUND` |

```ts
type LiveStream = { id: string; host: UserPreview; status: 'LIVE' | 'ENDED'; startedAt: string; endedAt: string | null };
type LiveJoin = { live: LiveStream; token: string; url: string; isHost: boolean };
```

- Токен ведущего разрешает публиковать. Токен зрителя — `canPublish: false`, `canPublishData: true`: только смотреть и отправлять чат и сердечки.
- LIVE-7: эфир закрытого аккаунта доступен только подтверждённым подписчикам (`FollowsService.canViewContent`); при блокировке в любую сторону — `404`.

## 3. Уведомления (LIVE-2, LIVE-3)

- При старте эфира каждый подписчик получает уведомление `LIVE_STARTED` (actor — ведущий) и push «user начал(а) прямой эфир» (категория `follows`). Ссылка — `/live/:username`.
- Ведущему и подписчикам приходят сокет-события `live:started` / `live:ended` `{ liveId, hostId }`: фронтенд обновляет кольца LIVE в панели Stories.

## 4. Вебхук LiveKit

Один вебхук `POST /api/calls/livekit-webhook` на всё приложение. Комнаты `call_*` обрабатывает модуль звонков, остальные он передаёт в `LiveKitEventsService`, где модуль эфира подписан на префикс `live_`:

- `participant_joined` ведущего → `hostLeftAt = null`;
- `participant_left` / `participant_connection_aborted` ведущего → `hostLeftAt = now`;
- `room_finished` → эфир завершается.

Завершение (ведущим или само) ставит `ENDED`, закрывает комнату LiveKit — у зрителей разрывается соединение, и они видят «Эфир завершён» — и рассылает `live:ended`.

## 5. Чат, сердечки, зрители (LIVE-4, LIVE-5)

Чат и сердечки идут через саму комнату LiveKit — сообщения данных с темами `live-chat` (текст до `LIVE_COMMENT_MAX` = 150 символов) и `live-heart`; через API они не проходят и не сохраняются. Имя и аватар отправителя берутся из участника LiveKit (имя и `metadata.avatarUrl` в токене). Счётчик зрителей — участники комнаты, кроме ведущего; при входе нового зрителя в чате появляется строка «… присоединился(-ась)».

## 6. Фронтенд

- `/live` — студия ведущего: зеркало камеры → «Начать эфир» → эфир → «Завершить» с подтверждением → итог «Вы были в эфире N минут». Вход — кнопка «Начать эфир» в окне «Создать».
- `/live/:username` — экран зрителя на весь экран.
- Кольца LIVE (`features/live/components/live-rings.tsx`) стоят в панели Stories сразу после «Ваша история».
