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
| PATCH | `/users/me/password` | `{ currentPassword?, newPassword }` | `204` |
| GET | `/users/:username` | — | `UserProfile` |
| GET | `/users/:username/posts` | `cursor, limit` | `Page<Post>` (type=POST) |
| GET | `/users/:username/reels` | `cursor, limit` | `Page<Post>` (type=REEL) |
| GET | `/users/:username/tagged` | `cursor, limit` | `Page<Post>` |
| GET | `/users/me/saved` | `cursor, limit` | `Page<Post>` |
| GET | `/users/:username/followers` | `cursor, limit, q?` | `Page<UserPreview & { followStatus }>` |
| GET | `/users/:username/following` | `cursor, limit, q?` | то же |
| GET | `/users/suggestions` | `limit` | `UserPreview[]` |

### Follow

| Метод | Путь | Ответ |
|---|---|---|
| POST | `/users/:username/follow` | `{ followStatus: 'ACCEPTED' \| 'PENDING' }` |
| DELETE | `/users/:username/follow` | `204` (отписка или отмена запроса) |
| DELETE | `/users/:username/follower` | `204` (удалить подписчика) |
| GET | `/follow-requests` | `Page<UserPreview>` |
| POST | `/follow-requests/:userId/accept` | `204` |
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
| POST | `/media/signature` | `{ folder: 'posts' \| 'reels' \| 'stories' \| 'avatars' \| 'messages' }` | `{ signature, timestamp, apiKey, cloudName, folder }` |

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
  id: string; text: string; author: UserPreview; parentId: string | null;
  likesCount: number; repliesCount: number; isLiked: boolean; createdAt: string;
};
```

### Search & explore

| Метод | Путь | Параметры | Ответ |
|---|---|---|---|
| GET | `/search/users` | `q, limit` | `UserPreview[]` |
| GET | `/search/hashtags` | `q, limit` | `{ name, postsCount }[]` |
| GET | `/search/history` | — | `UserPreview[]` |
| POST | `/search/history` | `{ userId }` | `204` |
| DELETE | `/search/history/:userId` | — | `204` (`/search/history` без id — очистить всё) |
| GET | `/explore` | `cursor, limit` | `Page<Post>` |
| GET | `/hashtags/:name` | — | `{ name, postsCount }` |
| GET | `/hashtags/:name/posts` | `cursor, limit` | `Page<Post>` |

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
| GET | `/conversations/:id/messages` | `cursor, limit` | `Page<Message>` (от новых к старым) |
| POST | `/conversations/:id/messages` | `{ type, text?, mediaUrl?, mediaType?, postId?, storyId?, replyToId? }` | `Message` |
| POST | `/conversations/direct/:userId/messages` | то же | `Message` (создаёт переписку при необходимости) |
| DELETE | `/messages/:id` | — | `204` (только свои, soft delete) |
| PUT | `/messages/:id/reaction` | `{ emoji }` | `204` |
| DELETE | `/messages/:id/reaction` | — | `204` |
| POST | `/conversations/:id/read` | — | `204` (обновить `lastReadAt`) |
| GET | `/conversations/unread-count` | — | `{ count }` |

**Почему отправка сообщения через REST, а не через сокет:** REST проще валидировать и отлаживать, а ответ однозначно говорит, сохранилось ли сообщение. Рассылку другим участникам делает сервер через Socket.IO после сохранения. Схема — в [realtime.md](./realtime.md#как-отправляется-сообщение).

```ts
type ConversationPreview = {
  id: string; isGroup: boolean; title: string; avatarUrls: string[];
  lastMessage: MessagePreview | null; unreadCount: number;
  activeCall: { id: string; type: 'AUDIO' | 'VIDEO' } | null;
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
