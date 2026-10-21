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
    ├── common/                общий код для всех модулей
    │   ├── decorators/        @Public(), @CurrentUser()
    │   ├── guards/            JwtAuthGuard (глобальный)
    │   ├── pipes/             ZodValidationPipe
    │   ├── filters/           обработка ошибок Prisma → HTTP
    │   └── pagination.ts      cursor-пагинация
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
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPostSchema)) dto: CreatePostInput,
  ) {
    return this.postsService.create(user.id, dto);
  }
}
```

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
9. **Ошибки** — стандартные исключения NestJS с **кодом** из `ErrorCode` (`@instagram/shared`) и английским текстом: `throw new ConflictException({ code: ErrorCode.USERNAME_TAKEN, message: "This username isn't available." })`. Пользователю фронт показывает перевод по коду (см. [i18n.md](./i18n.md)).
10. **Готовый текст не храним в БД** для уведомлений и системных сообщений — только тип и данные, текст собирает фронт на языке читателя. Исключение — push: его текст собирается на бэкенде по `User.language`.
11. **Rate limiting** (`@nestjs/throttler`) на вход, регистрацию и отправку сообщений.

## 4. Основные зависимости

`@nestjs/core`, `@nestjs/config`, `@nestjs/passport`, `passport-jwt`, `passport-google-oauth20`, `@nestjs/jwt`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/swagger`, `@nestjs/throttler`, `@nestjs/schedule`, `prisma`, `@prisma/client`, `argon2`, `cookie-parser`, `cloudinary`, `livekit-server-sdk`, `web-push`, `ua-parser-js` (браузер и ОС для списка сессий), `zod`.

## 5. Команды

```bash
pnpm --filter api dev                          # запуск в режиме разработки (порт 4000)
pnpm --filter api prisma migrate dev --name x  # новая миграция после изменения схемы
pnpm --filter api prisma studio                # просмотр БД в браузере
pnpm --filter api prisma db seed               # тестовые данные
pnpm --filter api test                         # тесты
```

## 6. Тестовые данные (seed)

`prisma/seed.ts` создаёт 10 пользователей (пароль у всех `password123`), подписки между ними, по несколько постов, Reels и Stories с картинками-заглушками. Так у любого, кто запустил проект, сразу непустая лента.
