# База данных

PostgreSQL + Prisma. Схема ниже — **черновик будущего файла** `apps/api/prisma/schema.prisma`. Она описана сразу для всех фич, чтобы два человека не правили схему одновременно.

## 1. Общие правила

- ID — `cuid()` (строки, не угадываются по порядку, в отличие от 1, 2, 3).
- У каждой таблицы `createdAt`; у изменяемых — `updatedAt`.
- Имена моделей — `PascalCase`, полей — `camelCase`, таблиц в БД — `snake_case` через `@@map`.
- **Счётчики денормализованы** (`likesCount`, `followersCount`…): хранятся прямо в строке и обновляются в той же транзакции, что и действие. Считать `COUNT(*)` на каждый показ поста слишком медленно.
- Удаление пользователя или поста каскадно удаляет связанные данные (`onDelete: Cascade`).
- Любое изменение схемы — только через миграцию: `pnpm --filter api prisma migrate dev --name <что_изменили>`.

## 2. Схема связей (упрощённо)

```
User ─┬─< Post ─┬─< PostMedia
      │         ├─< Like >── User
      │         ├─< Comment ─< CommentLike
      │         ├─< SavedPost
      │         ├─< PostTag (отметки людей)
      │         └─< PostHashtag >── Hashtag
      ├─< Follow (follower → following, статус PENDING/ACCEPTED)
      ├─< Block
      ├─< Story ─┬─< StoryView
      │          └─< HighlightItem >── Highlight
      ├─< ConversationMember >── Conversation ─┬─< Message ─< MessageReaction
      │                                        └─< Call ─< CallParticipant
      ├─< Notification
      ├─< Session
      ├─< PushSubscription
      └── NotificationSettings (1 к 1)
```

## 3. Prisma-схема

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────── Users & auth ─────────────

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  username       String    @unique
  fullName       String
  passwordHash   String?   // null for Google-only accounts
  googleId       String?   @unique
  avatarUrl      String?
  bio            String?   @db.VarChar(150)
  website        String?
  isPrivate      Boolean   @default(false)
  lastSeenAt     DateTime?

  // settings
  showActivityStatus Boolean           @default(true)     // "Active now" / "Active 5m ago"
  messagePermission  MessagePermission @default(EVERYONE)
  theme              Theme             @default(SYSTEM)
  language           Language          @default(EN)

  postsCount     Int       @default(0)
  followersCount Int       @default(0)
  followingCount Int       @default(0)

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  sessions           Session[]
  posts              Post[]
  likes              Like[]
  comments           Comment[]
  commentLikes       CommentLike[]
  savedPosts         SavedPost[]
  taggedIn           PostTag[]
  following          Follow[]             @relation("follower")
  followers          Follow[]             @relation("following")
  blocking           Block[]              @relation("blocker")
  blockedBy          Block[]              @relation("blocked")
  stories            Story[]
  storyViews         StoryView[]
  highlights         Highlight[]
  conversations      ConversationMember[]
  messages           Message[]
  messageReactions   MessageReaction[]
  callsStarted       Call[]
  callParticipations CallParticipant[]
  notifications      Notification[]       @relation("recipient")
  notificationsSent  Notification[]       @relation("actor")
  searchHistory      SearchHistory[]      @relation("searcher")
  searchedBy         SearchHistory[]      @relation("searched")
  notificationSettings NotificationSettings?
  pushSubscriptions    PushSubscription[]

  @@map("users")
}

enum MessagePermission {
  EVERYONE
  FOLLOWING // only people I follow can start a conversation with me
}

enum Theme {
  LIGHT
  DARK
  SYSTEM
}

enum Language {
  EN // default
  RU
}

model Session {
  id               String   @id @default(cuid())
  userId           String
  refreshTokenHash String
  userAgent        String?  // parsed for "Where you're logged in": Chrome · Windows
  ip               String?
  lastUsedAt       DateTime @default(now()) // updated on every refresh
  expiresAt        DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

// ───────────── Settings & push ─────────────

model NotificationSettings {
  userId      String    @id
  pushEnabled Boolean   @default(true)
  likes       Boolean   @default(true) // post, reel, comment, story likes
  comments    Boolean   @default(true) // comments, replies, mentions, tags
  follows     Boolean   @default(true) // follows, requests, accepted requests
  messages    Boolean   @default(true)
  calls       Boolean   @default(true)
  pausedUntil DateTime? // "pause all" for 1/8/24 hours

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_settings")
}

// One row per browser where the user allowed notifications
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_subscriptions")
}

// ───────────── Social graph ─────────────

enum FollowStatus {
  PENDING   // request to a private account
  ACCEPTED
}

model Follow {
  followerId  String
  followingId String
  status      FollowStatus @default(ACCEPTED)
  createdAt   DateTime     @default(now())

  follower  User @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("following", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followingId, status])
  @@map("follows")
}

model Block {
  blockerId String
  blockedId String
  createdAt DateTime @default(now())

  blocker User @relation("blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked User @relation("blocked", fields: [blockedId], references: [id], onDelete: Cascade)

  @@id([blockerId, blockedId])
  @@map("blocks")
}

// ───────────── Posts & reels ─────────────

enum PostType {
  POST  // regular post, 1–10 media items (carousel)
  REEL  // single vertical video
}

enum MediaType {
  IMAGE
  VIDEO
}

model Post {
  id               String   @id @default(cuid())
  authorId         String
  type             PostType @default(POST)
  caption          String?  @db.VarChar(2200)
  commentsDisabled Boolean  @default(false)

  likesCount    Int @default(0)
  commentsCount Int @default(0)
  viewsCount    Int @default(0) // reels only

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  author   User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  media    PostMedia[]
  likes    Like[]
  comments Comment[]
  saves    SavedPost[]
  tags     PostTag[]
  hashtags PostHashtag[]
  messages Message[]     // shares into DM

  @@index([authorId, createdAt(sort: Desc)])
  @@index([type, createdAt(sort: Desc)])
  @@map("posts")
}

model PostMedia {
  id        String    @id @default(cuid())
  postId    String
  type      MediaType
  url       String
  publicId  String    // Cloudinary public_id
  width     Int
  height    Int
  duration  Float?    // seconds, video only
  thumbnailUrl String? // video poster
  order     Int

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId, order])
  @@map("post_media")
}

model PostTag {
  postId String
  userId String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([postId, userId])
  @@index([userId])
  @@map("post_tags")
}

model Hashtag {
  id         String        @id @default(cuid())
  name       String        @unique // lowercase, without '#'
  postsCount Int           @default(0)
  posts      PostHashtag[]

  @@map("hashtags")
}

model PostHashtag {
  postId    String
  hashtagId String

  post    Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  hashtag Hashtag @relation(fields: [hashtagId], references: [id], onDelete: Cascade)

  @@id([postId, hashtagId])
  @@index([hashtagId])
  @@map("post_hashtags")
}

// ───────────── Engagement ─────────────

model Like {
  userId    String
  postId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@id([userId, postId])
  @@index([postId, createdAt(sort: Desc)])
  @@map("likes")
}

model Comment {
  id           String   @id @default(cuid())
  postId       String
  authorId     String
  parentId     String?  // reply to a top-level comment (one level only)
  text         String   @db.VarChar(2200)
  likesCount   Int      @default(0)
  repliesCount Int      @default(0)
  createdAt    DateTime @default(now())

  post    Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  author  User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parent  Comment?      @relation("replies", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[]     @relation("replies")
  likes   CommentLike[]

  @@index([postId, parentId, createdAt])
  @@map("comments")
}

model CommentLike {
  userId    String
  commentId String
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  comment Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@id([userId, commentId])
  @@map("comment_likes")
}

model SavedPost {
  userId    String
  postId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@id([userId, postId])
  @@index([userId, createdAt(sort: Desc)])
  @@map("saved_posts")
}

model SearchHistory {
  searcherId String
  searchedId String
  createdAt  DateTime @default(now())

  searcher User @relation("searcher", fields: [searcherId], references: [id], onDelete: Cascade)
  searched User @relation("searched", fields: [searchedId], references: [id], onDelete: Cascade)

  @@id([searcherId, searchedId])
  @@map("search_history")
}

// ───────────── Stories ─────────────

model Story {
  id           String    @id @default(cuid())
  authorId     String
  mediaType    MediaType
  url          String
  publicId     String
  thumbnailUrl String?
  duration     Float?    // video length; images show for 5s
  viewsCount   Int       @default(0)
  expiresAt    DateTime  // createdAt + 24h
  createdAt    DateTime  @default(now())

  author     User            @relation(fields: [authorId], references: [id], onDelete: Cascade)
  views      StoryView[]
  highlights HighlightItem[]
  replies    Message[]

  @@index([authorId, expiresAt])
  @@map("stories")
}

model StoryView {
  storyId   String
  viewerId  String
  liked     Boolean  @default(false)
  createdAt DateTime @default(now())

  story  Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  viewer User  @relation(fields: [viewerId], references: [id], onDelete: Cascade)

  @@id([storyId, viewerId])
  @@map("story_views")
}

model Highlight {
  id        String   @id @default(cuid())
  ownerId   String
  title     String   @db.VarChar(30)
  coverUrl  String?
  createdAt DateTime @default(now())

  owner User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  items HighlightItem[]

  @@index([ownerId])
  @@map("highlights")
}

model HighlightItem {
  highlightId String
  storyId     String
  addedAt     DateTime @default(now())

  highlight Highlight @relation(fields: [highlightId], references: [id], onDelete: Cascade)
  story     Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@id([highlightId, storyId])
  @@map("highlight_items")
}

// ───────────── Direct messages ─────────────

model Conversation {
  id            String    @id @default(cuid())
  isGroup       Boolean   @default(false)
  title         String?   // groups only
  avatarUrl     String?   // groups only
  lastMessageAt DateTime  @default(now())
  createdAt     DateTime  @default(now())

  members  ConversationMember[]
  messages Message[]
  calls    Call[]

  @@index([lastMessageAt(sort: Desc)])
  @@map("conversations")
}

enum MemberRole {
  ADMIN  // group creator; can rename, add, remove members
  MEMBER
}

model ConversationMember {
  conversationId String
  userId         String
  role           MemberRole @default(MEMBER)
  lastReadAt     DateTime   @default(now())
  joinedAt       DateTime   @default(now())
  leftAt         DateTime?  // left the group; keeps history

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([conversationId, userId])
  @@index([userId])
  @@map("conversation_members")
}

enum MessageType {
  TEXT
  MEDIA        // photo or video
  POST_SHARE   // shared post or reel
  STORY_REPLY  // reply to a story
  CALL         // call record: "Video call · 12 min" / "Missed call"
  SYSTEM       // "Ivan added Maria", "Group renamed"
}

model Message {
  id             String      @id @default(cuid())
  conversationId String
  senderId       String
  type           MessageType @default(TEXT)
  text           String?     @db.VarChar(4000)
  mediaUrl       String?
  mediaType      MediaType?
  postId         String?     // POST_SHARE
  storyId        String?     // STORY_REPLY
  callId         String?     // CALL
  replyToId      String?
  systemData     Json?       // SYSTEM: { action: 'MEMBER_ADDED', actorId, targetIds } — text is built on the frontend in the viewer's language
  deletedAt      DateTime?   // soft delete: "Message deleted"
  createdAt      DateTime    @default(now())

  conversation Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User              @relation(fields: [senderId], references: [id], onDelete: Cascade)
  post         Post?             @relation(fields: [postId], references: [id], onDelete: SetNull)
  story        Story?            @relation(fields: [storyId], references: [id], onDelete: SetNull)
  call         Call?             @relation(fields: [callId], references: [id], onDelete: SetNull)
  replyTo      Message?          @relation("replies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies      Message[]         @relation("replies")
  reactions    MessageReaction[]

  @@index([conversationId, createdAt(sort: Desc)])
  @@map("messages")
}

model MessageReaction {
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([messageId, userId]) // one reaction per user per message
  @@map("message_reactions")
}

// ───────────── Calls ─────────────

enum CallType {
  AUDIO
  VIDEO
}

enum CallStatus {
  RINGING  // 1:1 call waiting for answer
  ACTIVE   // someone is in the room
  ENDED
  MISSED   // 1:1 not answered / declined
}

model Call {
  id             String     @id @default(cuid())
  conversationId String
  startedById    String
  type           CallType
  status         CallStatus @default(RINGING)
  roomName       String     @unique // LiveKit room: "call_<id>"
  startedAt      DateTime   @default(now())
  answeredAt     DateTime?
  endedAt        DateTime?

  conversation Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  startedBy    User              @relation(fields: [startedById], references: [id], onDelete: Cascade)
  participants CallParticipant[]
  messages     Message[]

  @@index([conversationId, status])
  @@map("calls")
}

model CallParticipant {
  callId   String
  userId   String
  joinedAt DateTime  @default(now())
  leftAt   DateTime?

  call Call @relation(fields: [callId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([callId, userId])
  @@map("call_participants")
}

// ───────────── Notifications ─────────────

enum NotificationType {
  POST_LIKE
  COMMENT
  COMMENT_REPLY
  COMMENT_LIKE
  FOLLOW
  FOLLOW_REQUEST
  FOLLOW_ACCEPTED
  MENTION
  POST_TAG
  STORY_LIKE
}

model Notification {
  id          String           @id @default(cuid())
  recipientId String
  actorId     String
  type        NotificationType
  postId      String?
  commentId   String?
  storyId     String?
  isRead      Boolean          @default(false)
  createdAt   DateTime         @default(now())

  recipient User @relation("recipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User @relation("actor", fields: [actorId], references: [id], onDelete: Cascade)

  @@index([recipientId, createdAt(sort: Desc)])
  @@map("notifications")
}
```

## 4. Важные правила доступа к данным

Эти правила проверяются **в сервисах NestJS**, а не на фронтенде.

| Ситуация | Правило |
|---|---|
| Можно ли видеть посты/Reels/Stories пользователя X | X — это я, **или** X публичный, **или** у меня `Follow` к X со статусом `ACCEPTED`. И между нами нет `Block` ни в одну сторону |
| Лента | Посты типа `POST` от пользователей, на которых у меня `ACCEPTED`-подписка, плюс мои, по `createdAt desc` |
| Explore | Посты и Reels публичных аккаунтов, на которых я не подписан, за последние 7 дней, по `likesCount desc` |
| Активные Stories | `expiresAt > now()`. Просроченные не удаляются (нужны для Highlights), а просто не показываются |
| Сообщения | Только участник переписки (`ConversationMember` без `leftAt`) может читать и писать |
| Звонки | Только участник переписки может начать звонок или подключиться к нему |
| Счётчики | Меняются в **той же транзакции** (`prisma.$transaction`), что и действие (лайк → `likesCount + 1`) |
| Хэштеги | При создании/редактировании поста парсятся из подписи (`#слово`), имена приводятся к нижнему регистру |
| Личные переписки | Для пары пользователей существует ровно одна `Conversation` с `isGroup=false`; повторное «Написать» открывает её |
| Кто может написать | Если у получателя `messagePermission = FOLLOWING` и он не подписан на отправителя — новую личную переписку создать нельзя (403). Существующие переписки работают |
| Статус «в сети» | Если `showActivityStatus = false` — другим не отдаётся ни `isOnline`, ни `lastSeenAt`, и сам пользователь тоже не видит чужие статусы (как в Instagram) |
