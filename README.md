# Instagram — учебная копия

Веб-копия Instagram: посты, лента, Stories, Reels, директ, аудио- и видеозвонки (в том числе групповые), уведомления в реальном времени.

Учебный проект команды из двух человек, разработка с помощью Claude Code.

## Документация

| Документ | Что внутри |
|---|---|
| [docs/TZ.md](docs/TZ.md) | Техническое задание: все функции и требования |
| [docs/spec/](docs/spec/README.md) | Спецификация: архитектура, БД, API, realtime, звонки |
| [docs/ROADMAP.md](docs/ROADMAP.md) | План по дням |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Правила работы с Git и GitHub |
| [CLAUDE.md](CLAUDE.md) | Инструкция для AI-ассистента |

## Стек

**Фронтенд:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Axios, TanStack Query, Zustand, react-hook-form, zod
**Бэкенд:** NestJS, TypeScript, Prisma, PostgreSQL, Passport (JWT + Google), Socket.IO
**Сервисы:** Cloudinary (фото и видео), LiveKit (звонки)
**Инфраструктура:** pnpm workspaces, Turborepo, Docker Compose, GitHub Actions

## Структура

```
apps/
  web/        Next.js — интерфейс
  api/        NestJS — REST API и WebSocket
packages/
  shared/     общие типы, zod-схемы, константы
  config/     общие настройки TypeScript, ESLint, Prettier
docs/         ТЗ, спецификация, roadmap
```

## Запуск локально

### Что нужно установить

- [Node.js 24+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — в нём работают база данных PostgreSQL и сервер звонков LiveKit. Перед работой Docker Desktop должен быть **запущен** (статус *Engine running*).
- pnpm:

```bash
npm install -g pnpm
```

### Первый запуск (один раз)

**1. Установить зависимости**

```bash
pnpm install
```

**2. Создать файл настроек бэкенда из шаблона**

```bash
cp apps/api/.env.example apps/api/.env
```

Открыть `apps/api/.env` и заполнить `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_SOCKET_SECRET` — три **разные** случайные строки длиной от 32 символов. Сгенерировать строку:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Остальные переменные для начала можно не трогать. Без ключей Cloudinary не работает загрузка фото и видео, без ключей Google — вход через Google, без VAPID-ключей — push-уведомления (`npx web-push generate-vapid-keys`). Всё остальное работает.

**3. Запустить базу данных и LiveKit**

```bash
pnpm db:up
```

**4. Создать таблицы в базе**

```bash
pnpm --filter api prisma migrate deploy
```

**5. Залить тестовые данные**

```bash
pnpm --filter api db:seed
```

Будет 10 пользователей с постами, Reels, Stories и переписками. Пароль у всех `password123`, например логин `alex.morgan` или `maria.ivanova`. Аккаунт `emma.design` — приватный.

### Каждый день

1. Открыть Docker Desktop и дождаться *Engine running*.
2. Поднять базу:

```bash
pnpm db:up
```

3. Запустить проект:

```bash
pnpm dev
```

4. Открыть в браузере:

| Что | Адрес |
|---|---|
| Сайт (появится вместе с фронтендом `apps/web`) | http://localhost:3000 |
| API | http://localhost:4000/api |
| Swagger (документация API, можно отправлять запросы) | http://localhost:4000/api/docs |
| Проверка, что всё работает (`"db":"ok"`) | http://localhost:4000/api/health |

**Остановить:** `Ctrl+C` в терминале с `pnpm dev`. Базу можно оставить или остановить — данные при этом **не удаляются**:

```bash
pnpm db:down
```

### Полезные команды

| Команда | Что делает |
|---|---|
| `pnpm --filter api db:studio` | Открывает базу в браузере — смотреть и править таблицы |
| `pnpm --filter api db:seed` | Заново заливает тестовые данные (**стирает всё**) |
| `pnpm --filter api db:migrate --name <имя>` | Новая миграция после изменения `schema.prisma` |
| `pnpm test` | Unit-тесты |
| `pnpm --filter api test:e2e` | e2e-тесты (нужна запущенная база) |
| `pnpm lint` | Проверка стиля кода |
| `pnpm typecheck` | Проверка типов TypeScript |
| `pnpm build` | Сборка всего проекта |

### Если что-то не работает

| Ошибка | Что делать |
|---|---|
| `docker: command not found` или `Cannot connect to the Docker daemon` | Запустить Docker Desktop и дождаться *Engine running* |
| `Invalid environment variables (apps/api/.env)` | В сообщении перечислены неверные переменные — проверить `apps/api/.env` (чаще всего не заполнены JWT-секреты) |
| `EADDRINUSE: address already in use :::4000` | Порт 4000 уже занят — бэкенд запущен в другом терминале. Закрыть его |
| `P1000: Authentication failed` / `Can't reach database server` | База не запущена (`pnpm db:up`). Наша база в Docker работает на порту **5433**, а не 5432 — проверить `DATABASE_URL` в `.env` |
| `The table ... does not exist` | Не созданы таблицы: `pnpm --filter api prisma migrate deploy` |
