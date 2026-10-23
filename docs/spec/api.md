# REST API

Базовый путь: `/api`. Формат: JSON. Авторизация: httpOnly cookies (см. [auth.md](./auth.md)).
Swagger-документация генерируется автоматически: `http://localhost:4000/api/docs`.

## 1. Общие соглашения

### Пагинация (курсорная)

Все списки (лента, комментарии, сообщения, уведомления…) отдаются страницами:

```
GET /api/feed?cursor=<id>&limit=12
→ { "items": [...], "nextCursor": "ckx..." | null }
```

`nextCursor = null` значит, что больше данных нет. `limit` по умолчанию 20, максимум 50.

**Почему курсор, а не `?page=2`:** если пока ты листаешь, появился новый пост, номера страниц сдвигаются и посты повторяются. Курсор («дай всё старше этого») так не ломается. И `useInfiniteQuery` в TanStack Query работает именно так.

### Ошибки

Формат NestJS + поле `code`, по которому фронт показывает перевод (см. [i18n.md](./i18n.md)):
```json
{ "statusCode": 409, "code": "USERNAME_TAKEN", "message": "This username isn't available.", "error": "Conflict" }
```

| Код | Когда |
|---|---|
| 400 | Неверные данные (валидация zod) |
| 401 | Не авторизован / токен истёк |
| 403 | Авторизован, но нет прав (чужой пост, приватный аккаунт) |
| 404 | Не найдено (или скрыто блокировкой — не раскрываем, что объект существует) |
| 409 | Конфликт (email/username занят) |
| 429 | Слишком много запросов |

### Объекты в ответах

Типы описываются в `packages/shared/src/types`. Основные:

```ts
type UserPreview = {
  id: string; username: string; fullName: string;
  avatarUrl: string | null; hasActiveStory: boolean; hasUnseenStory: boolean;
};

type UserProfile = UserPreview & {
  bio: string | null; website: string | null; isPrivate: boolean;
  postsCount: number; followersCount: number; followingCount: number;
  isMe: boolean;
  followStatus: 'NONE' | 'PENDING' | 'ACCEPTED';   // my follow to them
  followsMe: boolean;
  canViewContent: boolean;                           // false = private and not followed
};

type Post = {
  id: string; type: 'POST' | 'REEL'; author: UserPreview;
  caption: string | null; media: PostMedia[];
  likedBy: UserPreview[]; // до 3 лайкнувших для «Нравится maria и ещё 5»: сначала мои подписки, потом последние; без меня и заблокированных
  likesCount: number; commentsCount: number; viewsCount: number;
  isLiked: boolean; isSaved: boolean; commentsDisabled: boolean;
  createdAt: string;
};

type PostMedia = {
  id: string; type: 'IMAGE' | 'VIDEO'; url: string;
  width: number; height: number; duration: number | null; thumbnailUrl: string | null;
};
```

## 2. Эндпоинты

🔓 — публичный, без авторизации. Остальные требуют авторизации.

### Auth — [auth.md](./auth.md)

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| POST 🔓 | `/auth/register` | `{ email, fullName, username, password }` | `Me` + cookies |
| POST 🔓 | `/auth/login` | `{ login, password }` | `Me` + cookies |
| POST 🔓 | `/auth/refresh` | cookie `refresh_token` | `204` + новые cookies |
| POST | `/auth/logout` | — | `204`, cookies очищены |
| GET 🔓 | `/auth/google` | — | редирект в Google |
| GET 🔓 | `/auth/google/callback` | `?code` | cookies + редирект на фронт |
| GET | `/auth/socket-token` | — | `{ token }` (1 минута) |

### Users & profile

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| GET | `/users/me` | — | `Me` (профиль + счётчики непрочитанного) |
| PATCH | `/users/me` | `{ fullName?, username?, bio?, website?, avatarUrl?, isPrivate? }` | `Me` |
| PATCH | `/users/me/password` | `{ currentPassword?, newPassword }` | `204`; выходит из всех сессий, кроме текущей. Неверный текущий → 400 `WRONG_PASSWORD` |
| GET | `/users/:username` | — | `UserProfile`. Он заблокировал меня → 404 `USER_NOT_FOUND`; я заблокировал его → профиль с `isBlocked: true`, `canViewContent: false` |
| GET | `/users/:username/posts` | `cursor, limit` | `Page<Post>` (type=POST) |
| GET | `/users/:username/reels` | `cursor, limit` | `Page<Post>` (type=REEL) |
| GET | `/users/:username/tagged` | `cursor, limit` | `Page<Post>` |
| GET | `/users/me/saved` | `cursor, limit` | `Page<Post>` |
| GET | `/users/:username/followers` | `cursor, limit, q?` | `Page<UserListItem>` (курсор = id пользователя; 403 `PRIVATE_ACCOUNT`, если нет доступа) |
| GET | `/users/:username/following` | `cursor, limit, q?` | то же |
| GET | `/users/suggestions` | `limit` (по умолч. 10) | `UserPreview[]`: на кого подписаны мои подписки, затем популярные публичные |

### Follow

| Метод | Путь | Ответ |
|---|---|---|
| POST | `/users/:username/follow` | `{ followStatus: 'ACCEPTED' \| 'PENDING' }` |
| DELETE | `/users/:username/follow` | `204` (отписка или отмена запроса) |
| DELETE | `/users/:username/follower` | `204` (удалить подписчика) |
| GET | `/follow-requests` | `Page<UserPreview>` |
| POST | `/follow-requests/:userId/accept` | `204` (уведомления: мне `FOLLOW`, ему `FOLLOW_ACCEPTED`) |
| DELETE | `/follow-requests/:userId` | `204` (отклонить) |

### Block

| Метод | Путь | Ответ |
|---|---|---|
| POST | `/users/:username/block` | `204` (заодно удаляет подписки в обе стороны) |
| DELETE | `/users/:username/block` | `204` |
| GET | `/users/me/blocked` | `UserPreview[]` |

### Media — [media.md](./media.md)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/media/signature` | `{ folder: 'posts' \| 'reels' \| 'stories' \| 'avatars' \| 'messages', transformation? }` | `200 { signature, timestamp, apiKey, cloudName, folder, transformation? }`; без ключей Cloudinary — `503 SERVICE_UNAVAILABLE` |

`transformation` — необязательная входящая трансформация (обрезка `c_crop,x_..,y_..,w_..,h_..`, см. [media.md](./media.md) §4). Она входит в подпись, поэтому фронт отправляет в Cloudinary ровно ту же строку.

### Posts & reels

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| POST | `/posts` | `{ type, caption?, media: UploadedMedia[], taggedUserIds? }` | `Post` |
| GET | `/posts/:id` | — | `Post` |
| PATCH | `/posts/:id` | `{ caption?, commentsDisabled? }` | `Post` |
| DELETE | `/posts/:id` | — | `204` (+ удаление файлов из Cloudinary) |
| GET | `/feed` | `cursor, limit` | `Page<Post>` |
| GET | `/reels` | `cursor, limit` | `Page<Post>` (все доступные Reels, свежие и популярные) |
| POST | `/posts/:id/view` | — | `204` (+1 просмотр Reel) |

`UploadedMedia = { type, url, publicId, width, height, duration?, thumbnailUrl? }` — то, что вернул Cloudinary.

Правила (реализация — `apps/api/src/modules/posts`):
- `publicId` должен лежать в `instagram/posts/` или `instagram/reels/`, иначе `400 INVALID_MEDIA`. Если ключи Cloudinary заданы, `url` должен начинаться с `https://res.cloudinary.com/<cloud>/`. Видео поста — до 60 с, Reel — до 90 с (по `duration`). Reel — ровно одно видео.
- `taggedUserIds`: несуществующие и заблокированные (в любую сторону) пользователи молча отбрасываются. Отмеченным — уведомление `POST_TAG`, упомянутым `@username` в подписи — `MENTION` (при редактировании — только новым упоминаниям).
- Хэштеги из подписи (`#слово`, нижний регистр, без повторов) обновляются при создании, редактировании и удалении вместе с `Hashtag.postsCount` в одной транзакции; хэштег с 0 постов удаляется.
- `User.postsCount` считает посты **и** Reels.
- Доступ: нет поста или между нами блокировка → `404 POST_NOT_FOUND`; закрытый аккаунт без подписки → `403 PRIVATE_ACCOUNT`. Редактировать и удалять может только автор (`403 FORBIDDEN`).
- `POST /posts/:id/view` увеличивает `viewsCount` только у Reels и только для чужих просмотров.
- `GET /reels` — все доступные Reels (свои, подписки, публичные аккаунты), от новых к старым.
- `GET /users/:username/posts|reels|tagged` — `:username` может быть `me`. Нет пользователя / блокировка → `404 USER_NOT_FOUND`, закрытый профиль → `403 PRIVATE_ACCOUNT`. В `tagged` попадают только посты, которые зритель может видеть. `GET /users/me/saved` — от последнего сохранения, курсор = id поста.

### Likes, comments, saves

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| POST | `/posts/:id/like` | — | `{ likesCount }` |
| DELETE | `/posts/:id/like` | — | `{ likesCount }` |
| GET | `/posts/:id/likes` | `cursor, limit` | `Page<UserPreview & { followStatus }>` |
| POST | `/posts/:id/save` | — | `204` |
| DELETE | `/posts/:id/save` | — | `204` |
| GET | `/posts/:id/comments` | `cursor, limit` | `Page<Comment>` (верхний уровень) |
| GET | `/comments/:id/replies` | `cursor, limit` | `Page<Comment>` |
| POST | `/posts/:id/comments` | `{ text, parentId? }` | `Comment` |
| DELETE | `/comments/:id` | — | `204` |
| POST | `/comments/:id/like` | — | `{ likesCount }` |
| DELETE | `/comments/:id/like` | — | `{ likesCount }` |

```ts
type Comment = {
  id: string; postId: string; text: string; author: UserPreview; parentId: string | null;
  likesCount: number; repliesCount: number; isLiked: boolean; createdAt: string;
};
```

- `POST /posts/:id/like` и `POST /comments/:id/like` отвечают `200`. Лайк, снятие лайка и сохранение идемпотентны. Лайкнуть/сохранить можно только доступный пост; снять лайк/сохранение — если пост просто существует.
- `GET /posts/:id/likes` — от новых лайков к старым, `q` фильтрует по username и имени, элементы — `UserListItem` (`followStatus`, `isMe`), курсор = id пользователя.
- Комментарии верхнего уровня — **от новых к старым**, ответы (`/comments/:id/replies`) — **от старых к новым**. Комментарии заблокированных пользователей скрыты.
- Один уровень вложенности: ответ на ответ прикрепляется к тому же комментарию верхнего уровня (`parentId` = корень), как в Instagram; `REPLY_DEPTH_EXCEEDED` не используется. `parentId` из другого поста → `404 COMMENT_NOT_FOUND`.
- `commentsDisabled` → `403 COMMENTS_DISABLED` для всех, включая автора.
- Удаление: автор комментария или автор поста (`403 FORBIDDEN` остальным). Удаление комментария верхнего уровня удаляет его ответы; `commentsCount` и `repliesCount` пересчитываются в той же транзакции.
- Уведомления: `COMMENT_REPLY` автору комментария, на который ответили, `COMMENT` автору поста, `MENTION` упомянутым `@username` — каждому не больше одного, себе никогда. При удалении комментария эти уведомления удаляются.

### Search & explore

| Метод | Путь | Параметры | Ответ |
|---|---|---|---|
| GET | `/search/users` | `q, limit` | `UserPreview[]` |
| GET | `/search/hashtags` | `q, limit` | `{ name, postsCount }[]` |
| GET | `/search/history` | — | `UserPreview[]` (последние 20, новые сверху) |
| POST | `/search/history` | `{ userId }` | `204` |
| DELETE | `/search/history/:userId` | — | `204` (`/search/history` без id — очистить всё) |
| GET | `/explore` | `cursor, limit` | `Page<Post>` |
| GET | `/hashtags/:name` | — | `{ name, postsCount }` (неизвестный хэштег → `postsCount: 0`, не 404; `#` в начале и регистр игнорируются) |
| GET | `/hashtags/:name/posts` | `cursor, limit` | `Page<Post>` (только доступные зрителю, от новых к старым) |

`GET /explore`: посты и Reels публичных аккаунтов, на которые я не подписан и не отправлял запрос (и не мои, без блокировок), за последние 7 дней, по `likesCount desc` (затем `createdAt desc`, `id desc`); если за 7 дней ничего нет — за всё время. Курсор = id поста.

### Stories & highlights

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| POST | `/stories` | `UploadedMedia` | `Story` |
| DELETE | `/stories/:id` | — | `204` |
| GET | `/stories/feed` | — | `StoryTray[]` (кольца над лентой: я первым, затем непросмотренные, затем просмотренные) |
| GET | `/users/:username/stories` | — | `Story[]` (активные) |
| POST | `/stories/:id/view` | — | `204` |
| POST | `/stories/:id/like` | — | `204` |
| DELETE | `/stories/:id/like` | — | `204` |
| GET | `/stories/:id/viewers` | `cursor, limit` | `Page<UserPreview & { liked }>` (только автор) |
| GET | `/stories/archive` | `cursor, limit` | `Page<Story>` (все мои, включая просроченные) |
| GET | `/users/:username/highlights` | — | `Highlight[]` |
| POST | `/highlights` | `{ title, storyIds, coverUrl? }` | `Highlight` |
| PATCH | `/highlights/:id` | `{ title?, addStoryIds?, removeStoryIds?, coverUrl? }` | `Highlight` |
| DELETE | `/highlights/:id` | — | `204` |
| GET | `/highlights/:id/stories` | — | `Story[]` |

```ts
type Story = {
  id: string; author: UserPreview; mediaType: 'IMAGE' | 'VIDEO'; url: string;
  thumbnailUrl: string | null; duration: number | null;
  isSeen: boolean; isLiked: boolean; viewsCount?: number; // viewsCount only for author
  createdAt: string; expiresAt: string;
};
type StoryTray = { user: UserPreview; hasUnseen: boolean; latestAt: string };
```

Детали поведения:
- `/users/:username/stories` и `/users/:username/highlights`: нет пользователя или блокировка → `404 USER_NOT_FOUND`; закрытый аккаунт без подписки → `403 PRIVATE_ACCOUNT`. Недоступная Story (`view`, `like`) → `404 STORY_NOT_FOUND`.
- `view` идемпотентен: `viewsCount` растёт один раз на зрителя; собственный просмотр автора записывается (кольцо становится серым), но не считается и не попадает в `viewers`. Лайк без просмотра тоже считается просмотром. Лайк своей Story → `403`.
- `viewers` отдаёт `StoryViewer = UserPreview & { liked, viewedAt }`, новые сверху; курсор — id зрителя.
- `Highlight.coverUrl`: если обложка не задана — превью первой Story. Highlight может остаться пустым после `removeStoryIds` (удаляется отдельно через `DELETE`).
- Удаление Story удаляет её просмотры, элементы Highlights и уведомления `STORY_LIKE`; сообщения-ответы в директе остаются (`storyId = null`).

Ответ на Story — это сообщение в директ: `POST /conversations/direct/:userId/messages` с `{ type: 'STORY_REPLY', storyId, text }`.

### Direct — см. также [realtime.md](./realtime.md)

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| GET | `/conversations` | `cursor, limit` | `Page<ConversationPreview>` |
| GET | `/conversations/:id` | — | `Conversation` (участники, активный звонок) |
| POST | `/conversations/direct/:userId` | — | `Conversation` (найти или создать личную) |
| POST | `/conversations/group` | `{ title?, memberIds }` | `Conversation` |
| PATCH | `/conversations/:id` | `{ title?, avatarUrl? }` | `Conversation` (только ADMIN) |
| POST | `/conversations/:id/members` | `{ userIds }` | `204` (только ADMIN) |
| DELETE | `/conversations/:id/members/:userId` | — | `204` (ADMIN удаляет; сам себя — выход) |
| PUT | `/conversations/:id/mute` | `{ messages?, calls? }` | `ConversationPreview` (заглушить чат только для себя: без push и карточек о сообщениях / без звонка-рингтона и push о звонках) |
| DELETE | `/conversations/:id` | — | `204` («Удалить чат» только для себя: чат пропадает из списка, история до этого момента скрыта; новое сообщение возвращает чат. Группа — ещё и выход) |
| GET | `/conversations/:id/messages` | `cursor, limit` | `Page<Message>` (от новых к старым) |
| POST | `/conversations/:id/messages` | `{ type, text?, mediaUrl?, mediaType?, postId?, storyId?, replyToId? }` | `Message` |
| POST | `/conversations/direct/:userId/messages` | то же | `Message` (создаёт переписку при необходимости) |
| DELETE | `/messages/:id` | — | `204` (только свои, soft delete) |
| PUT | `/messages/:id/reaction` | `{ emoji }` | `204` |
| DELETE | `/messages/:id/reaction` | — | `204` |
| POST | `/conversations/:id/read` | — | `204` (обновить `lastReadAt`) |
| GET | `/conversations/unread-count` | — | `{ count }` |

**Правила директа (реализация):**
- Чужим переписка не раскрывается: не участник → `404 CONVERSATION_NOT_FOUND`, бывший участник (вышел/удалён) → `403 NOT_A_MEMBER`.
- `POST /conversations/direct/:userId` отвечает `200`. Пустая личная переписка (открыли, но не писали) не показывается в `GET /conversations` до первого сообщения; группы видны всегда.
- Сам себе — `400`; блокировка в любую сторону — `404 USER_NOT_FOUND` при открытии и `403 MESSAGING_NOT_ALLOWED` при отправке/звонке в существующую личную переписку. `messagePermission` в группах не проверяется.
- `unreadCount` и `/conversations/unread-count` считают сообщения от других после моего `lastReadAt` (включая системные). Отправка сообщения сдвигает `lastReadAt` отправителя.
- `clientId` из тела `POST …/messages` возвращается в ответе и в `message:new`; в списке сообщений он `null`.
- Удалить можно только своё сообщение типа TEXT/MEDIA/POST_SHARE/STORY_REPLY; реакции при этом удаляются. На удалённые и системные сообщения реагировать нельзя.
- `STORY_REPLY`: история должна быть активна и доступна, а её автор — участником переписки. `POST_SHARE`: пост должен быть виден отправителю, иначе `404 POST_NOT_FOUND`. Если получателю пост/история недоступны, в `Message` придёт `post: null` / `story: null`.
- Группа: минимум 2 других участника, всего не больше `GROUP_MEMBERS_MAX` (`400 GROUP_TOO_LARGE`). Если вышел последний админ, админом становится самый давний участник. Добавление бывшего участника возвращает его в группу.
- Отправка сообщений ограничена 60 запросами в минуту.

**Почему отправка сообщения через REST, а не через сокет:** REST проще валидировать и отлаживать, а ответ однозначно говорит, сохранилось ли сообщение. Рассылку другим участникам делает сервер через Socket.IO после сохранения. Схема — в [realtime.md](./realtime.md#как-отправляется-сообщение).

```ts
type ConversationPreview = {
  id: string; isGroup: boolean; title: string; avatarUrls: string[];
  lastMessage: MessagePreview | null; unreadCount: number;
  activeCall: { id: string; type: 'AUDIO' | 'VIDEO' } | null;
  muted: { messages: boolean; calls: boolean }; // мои переключатели «без звука»
};
type Message = {
  id: string; conversationId: string; sender: UserPreview;
  type: 'TEXT' | 'MEDIA' | 'POST_SHARE' | 'STORY_REPLY' | 'CALL' | 'SYSTEM';
  text: string | null; mediaUrl: string | null; mediaType: 'IMAGE' | 'VIDEO' | null;
  post: Post | null; story: Story | null; call: CallSummary | null;
  replyTo: MessagePreview | null; reactions: { emoji: string; userId: string }[];
  systemData: { action: string; actor: UserPreview; targets: UserPreview[]; title?: string } | null; // SYSTEM only

  isDeleted: boolean; createdAt: string;
};
```

### Calls — [calls.md](./calls.md)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/conversations/:id/calls` | `{ type: 'AUDIO' \| 'VIDEO' }` | `{ call, token, url }` (начать; если уже идёт — ошибка 409 с id активного) |
| POST | `/calls/:id/join` | — | `{ call, token, url }` (принять / присоединиться) |
| POST | `/calls/:id/decline` | — | `204` (только 1 на 1) |
| POST | `/calls/:id/leave` | — | `204` |
| POST 🔓 | `/calls/livekit-webhook` | подписанный запрос от LiveKit | `204` |

### Notifications

| Метод | Путь | Параметры | Ответ |
|---|---|---|---|
| GET | `/notifications` | `cursor, limit` | `Page<Notification>` |
| GET | `/notifications/unread-count` | — | `{ count }` |
| POST | `/notifications/read-all` | — | `204` |

`GET /notifications` не помечает прочитанным — фронт вызывает `read-all` при открытии панели. Уведомления от заблокированных (в любую сторону) не показываются и не считаются. Повторное одинаковое непрочитанное уведомление не создаётся.

### Push — [push.md](./push.md)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/push/vapid-public-key` | — | `{ key }` |
| POST | `/push/subscriptions` | `{ endpoint, keys: { p256dh, auth } }` | `204` |
| DELETE | `/push/subscriptions` | `{ endpoint }` | `204` |

### Settings

Профиль редактируется через `PATCH /users/me`, пароль — `PATCH /users/me/password`, блокировки — раздел Block.

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/settings` | — | `Settings` |
| PATCH | `/settings` | `{ isPrivate?, showActivityStatus?, messagePermission?, theme?, language? }` | `Settings` |
| PATCH | `/settings/notifications` | `{ pushEnabled?, likes?, comments?, follows?, messages?, calls?, pauseHours?: 1 \| 8 \| 24 \| 0 }` | `Settings` |
| GET | `/settings/sessions` | — | `SessionInfo[]` |
| DELETE | `/settings/sessions/:id` | — | `204` (выйти на устройстве) |
| DELETE | `/settings/sessions` | — | `204` (выйти везде, кроме текущей) |

```ts
type Settings = {
  isPrivate: boolean; showActivityStatus: boolean;
  messagePermission: 'EVERYONE' | 'FOLLOWING'; theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: 'EN' | 'RU';
  hasPassword: boolean; // false for Google-only accounts
  notifications: {
    pushEnabled: boolean; likes: boolean; comments: boolean;
    follows: boolean; messages: boolean; calls: boolean; pausedUntil: string | null;
  };
};
type SessionInfo = {
  id: string; browser: string; os: string; // "Chrome", "Windows"
  lastUsedAt: string; isCurrent: boolean;
};
```

```ts
type Notification = {
  id: string; type: NotificationType; actor: UserPreview;
  post: { id: string; thumbnailUrl: string } | null;
  comment: { id: string; text: string } | null;
  actorFollowStatus: 'NONE' | 'PENDING' | 'ACCEPTED'; // for "Follow back" button
  isRead: boolean; createdAt: string;
};
```
