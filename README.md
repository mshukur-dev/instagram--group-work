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

> Раздел дополнится, когда будут созданы приложения.

Нужно установить: [Node.js 24+](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/), pnpm.

```bash
corepack enable
```

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
