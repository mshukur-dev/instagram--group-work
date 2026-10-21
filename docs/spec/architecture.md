# Архитектура

## 1. Общая схема

```
                         ┌──────────────────────────────┐
                         │          Браузер             │
                         │  Next.js (apps/web)          │
                         │  Axios · TanStack Query ·    │
                         │  Zustand · Socket.IO client ·│
                         │  LiveKit client              │
                         └──┬──────────┬─────────┬──────┘
             REST /api/*    │          │ WebSocket│ WebRTC (видео/звук)
      (через прокси Next.js)│          │          │
                         ┌──▼──────────▼───┐   ┌──▼──────────────┐
                         │  NestJS (apps/api)│  │    LiveKit      │
                         │  REST + Socket.IO │──│ (сервер звонков)│
                         └──┬─────────┬─────┘   └─────────────────┘
                            │ Prisma  │ подпись загрузки
                     ┌──────▼───┐  ┌──▼──────────┐
                     │PostgreSQL│  │ Cloudinary  │◄── браузер загружает
                     └──────────┘  │ (фото/видео)│    файлы напрямую
                                   └─────────────┘
```

**Кто за что отвечает:**

| Компонент | Ответственность |
|---|---|
| **Next.js** | Весь интерфейс. Рендерит страницы, ходит в API, держит WebSocket-соединение, подключается к звонкам |
| **NestJS** | Вся бизнес-логика и проверки прав: кто что может видеть и делать. Единственный, кто пишет в базу |
| **PostgreSQL** | Хранит все данные |
| **Cloudinary** | Хранит фото и видео, сжимает их, делает превью и разные размеры |
| **Socket.IO** (внутри NestJS) | Мгновенная доставка: сообщения, «печатает…», уведомления, сигналы звонков |
| **LiveKit** | Передача видео и звука в звонках. Наш сервер только выдаёт токен на вход в комнату |
| **Web Push** (push-сервис браузера) | Системные уведомления, когда вкладка закрыта или в фоне. Наш сервер отправляет, Service Worker на фронте показывает |

## 2. Стек

| Часть | Технология | Почему |
|---|---|---|
| Монорепо | pnpm workspaces + Turborepo | Один репозиторий для фронта, бэка и общего кода; Turborepo кэширует сборки |
| Язык | TypeScript (strict) везде | Типы общие для фронта и бэка, ошибки ловятся до запуска |
| Фронтенд | Next.js (App Router) | Требование проекта; роутинг на файлах, оптимизация картинок |
| Стили | Tailwind CSS + shadcn/ui | Быстро, единообразно, легко копировать дизайн Instagram |
| HTTP-клиент | Axios | Interceptors для автообновления токена и единой обработки ошибок |
| Серверные данные | TanStack Query | Кэш, бесконечная прокрутка, оптимистичные обновления (лайк мгновенно) |
| Клиентское состояние | Zustand | Простой стор для UI-состояния: модалки, звонок, плеер |
| Формы | react-hook-form + zod | Валидация теми же zod-схемами, что и на бэкенде |
| Языки | next-intl | Английский и русский, без языка в URL, правильные русские формы множественного числа |
| Бэкенд | NestJS | Требование проекта; модульная структура, DI, встроенные WebSocket-gateway |
| ORM | Prisma | Типобезопасные запросы, понятная схема, миграции |
| БД | PostgreSQL | Связанные данные (подписки, лайки, чаты) — реляционная БД подходит лучше всего |
| Авторизация | JWT + Passport (local, jwt, google-oauth20), argon2 | Стандарт для NestJS |
| Медиа | Cloudinary | Хранение + обработка фото и видео, бесплатный тариф |
| Realtime | Socket.IO | Комнаты, автопереподключение, встроен в NestJS |
| Звонки | LiveKit (`livekit-server-sdk`, `@livekit/components-react`) | Медиасервер (SFU): групповые звонки не тормозят. Локально бесплатно и без лимитов |
| Push-уведомления | Web Push (`web-push` + Service Worker) | Встроено в браузеры, бесплатно, без Firebase |
| Локальное окружение | Docker Compose | PostgreSQL и LiveKit поднимаются одной командой |
| CI | GitHub Actions | lint + typecheck + build на каждый PR |
| Деплой | Vercel (web) + Render (api) + Neon (БД) + LiveKit Cloud | Бесплатные тарифы |

## 3. Структура монорепо

```
instagram/
├── apps/
│   ├── web/                    Next.js — см. frontend.md
│   └── api/                    NestJS — см. backend.md
├── packages/
│   ├── shared/                 @instagram/shared — общий код фронта и бэка
│   │   └── src/
│   │       ├── schemas/        zod-схемы (registerSchema, createPostSchema…)
│   │       ├── types/          типы ответов API (UserDto, PostDto…)
│   │       ├── constants/      лимиты (MAX_CAROUSEL_ITEMS = 10…)
│   │       └── socket-events.ts имена и типы Socket.IO-событий
│   └── config/                 @instagram/config — общие tsconfig, eslint, prettier
├── docs/                       ТЗ, спек, roadmap
├── docker-compose.yml          PostgreSQL + LiveKit (dev)
├── CLAUDE.md                   инструкция для AI
└── turbo.json, pnpm-workspace.yaml, package.json
```

### Почему `packages/shared` важен

Схема `createPostSchema` описана **один раз**. Фронтенд проверяет ею форму до отправки, бэкенд проверяет ею запрос. Типы ответов тоже общие: если бэкенд поменял `PostDto`, TypeScript сразу покажет ошибки во фронтенде.

**Правило:** в `shared` кладём только то, что нужно **обоим** приложениям. Никакого кода, зависящего от React или NestJS.

## 4. Как фронтенд общается с бэкендом

1. **REST** (Axios → `/api/*`). Все запросы идут на тот же домен, что и фронт: Next.js проксирует `/api/*` на NestJS через `rewrites`. Благодаря этому cookies с токенами работают без проблем с кросс-доменными cookies (особенно на деплое: Vercel и Render — разные домены).
2. **WebSocket** (Socket.IO) — подключается **напрямую** к NestJS (Vercel не проксирует WebSocket). Для авторизации фронт сначала получает короткоживущий `socketToken` через REST и передаёт его при подключении. Подробнее в [realtime.md](./realtime.md).
3. **Медиа** — браузер загружает файлы **напрямую** в Cloudinary с подписью от нашего API. Подробнее в [media.md](./media.md).
4. **Звонки** — браузер подключается **напрямую** к LiveKit с токеном от нашего API. Подробнее в [calls.md](./calls.md).
5. **Push** — API отправляет уведомление в push-сервис браузера, Service Worker (`apps/web/public/sw.js`) его показывает. Подробнее в [push.md](./push.md).

## 4.1. Язык

Интерфейс на двух языках: **английский (основной)** и русский, через `next-intl`. API возвращает коды ошибок, фронт переводит их. Подробнее в [i18n.md](./i18n.md). Код и комментарии — на английском. Документация — на русском.

## 4.2. Что сознательно НЕ используем

| Технология | Почему не нужна сейчас | Когда понадобится |
|---|---|---|
| **Redis** (кэш, очереди, хранилище в памяти) | При наших объёмах PostgreSQL отвечает за миллисекунды; API — один процесс, поэтому онлайн-статусы и счётчики сокетов хранятся в памяти; очередей задач нет; rate limit — встроенный `@nestjs/throttler` | Несколько экземпляров API (нужен `@socket.io/redis-adapter`), тяжёлые фоновые задачи (BullMQ), кэш популярной ленты |
| **Микросервисы** | Один модульный NestJS проще разрабатывать, деплоить и отлаживать вдвоём | Большая команда, независимое масштабирование частей |
| **GraphQL** | REST + общие типы из `packages/shared` дают ту же типобезопасность проще | — |
| **Свой медиасервер / S3** | Cloudinary бесплатно хранит, сжимает и раздаёт через CDN | Большие объёмы, где Cloudinary дорог |

Архитектура позволяет добавить любое из этого позже, не переписывая проект: например, Redis-адаптер для Socket.IO подключается одной строкой.

## 5. Окружения

| | Локально | Деплой |
|---|---|---|
| Web | `http://localhost:3000` | Vercel |
| API | `http://localhost:4000` | Render |
| PostgreSQL | Docker, `localhost:5432` | Neon |
| LiveKit | Docker (`--dev`), `ws://localhost:7880` | LiveKit Cloud |
| Cloudinary | облако (общий аккаунт команды) | то же |

## 6. Переменные окружения

`apps/api/.env`:
```
DATABASE_URL=postgresql://instagram:instagram@localhost:5432/instagram
PORT=4000
WEB_URL=http://localhost:3000
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_SOCKET_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
VAPID_PUBLIC_KEY=...                      # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:team@example.com
```

`apps/web/.env.local`:
```
API_URL=http://localhost:4000             # куда Next.js проксирует /api/*
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
```

В репозиторий коммитим только `.env.example` с пустыми значениями. Настоящие ключи передаём друг другу лично, не через GitHub.
