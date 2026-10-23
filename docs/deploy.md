# Деплой

Схема (см. [architecture.md](./spec/architecture.md)): **Neon** (PostgreSQL) → **Render** (API, NestJS) → **Vercel** (сайт, Next.js) → **LiveKit Cloud** (звонки и эфиры). Всё на бесплатных тарифах. После настройки каждый мерж в `main` сам пересобирает API и сайт; миграции применяются при старте API.

Сайт ходит в API через свой домен (`/api/*` → Render через `rewrites` в `next.config.ts`), поэтому cookies с токенами — first-party. Socket.IO подключается к Render напрямую (Vercel не проксирует WebSocket).

## 1. Neon — база

1. neon.tech → новый проект, регион **AWS Europe Central 1 (Frankfurt)**, только Postgres.
2. Строку подключения (`postgresql://…?sslmode=require`) положить локально в `apps/api/.env.neon` (`DATABASE_URL=…`; файл в `.gitignore`).
3. Таблицы и демо-данные (пароль у всех — `password123`, сид **стирает** базу):

```bash
cd apps/api
dotenv -e .env.neon -- pnpm exec prisma migrate deploy
dotenv -e .env.neon -- pnpm exec prisma db seed
```

(без `dotenv-cli`: `DATABASE_URL="…" pnpm exec prisma migrate deploy` — переменная из окружения сильнее `.env`).

## 2. LiveKit Cloud

cloud.livekit.io → проект → **Settings → Keys**: адрес `wss://<project>.livekit.cloud`, API Key, API Secret. Webhook — в шаге 5.

## 3. Render — API

render.com → **New → Blueprint** → этот репозиторий: Render читает [`render.yaml`](../render.yaml) (Frankfurt, free, сборка через turbo, `prisma migrate deploy` при старте, проверка `/api/health`). Секреты JWT Render генерирует сам; остальное спрашивает:

| Переменная                                               | Значение                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | строка Neon                                                                           |
| `WEB_URL`                                                | адрес сайта на Vercel, например `https://instagram-xxx.vercel.app` (CORS и Socket.IO) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`               | как локально                                                                          |
| `GOOGLE_CALLBACK_URL`                                    | `https://<vercel>/api/auth/google/callback`                                           |
| `CLOUDINARY_*`                                           | как локально                                                                          |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`   | из LiveKit Cloud                                                                      |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | как локально (новые ключи = все подписки на push придётся включать заново)            |

`WEB_URL` и `GOOGLE_CALLBACK_URL` известны только после шага 4: сначала можно поставить заглушку и поменять потом (Render перезапустит сервис).

Проверка: `https://<render>/api/health` → `{"status":"ok","db":"ok"}`.

## 4. Vercel — сайт

vercel.com → **Add New → Project** → репозиторий, **Root Directory: `apps/web`** (сборку и установку задаёт [`apps/web/vercel.json`](../apps/web/vercel.json): turbo собирает `@instagram/shared` перед сайтом).

| Переменная                          | Значение                                      |
| ----------------------------------- | --------------------------------------------- |
| `API_URL`                           | адрес Render, `https://<render>` (без `/api`) |
| `NEXT_PUBLIC_SOCKET_URL`            | тот же адрес Render                           |
| `NEXT_PUBLIC_LIVEKIT_URL`           | `wss://<project>.livekit.cloud`               |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | как локально                                  |

## 5. Связать

1. На Render: `WEB_URL` и `GOOGLE_CALLBACK_URL` с настоящим адресом Vercel.
2. Google Cloud Console → OAuth-клиент: **Authorized redirect URIs** += `https://<vercel>/api/auth/google/callback`, **Authorized JavaScript origins** += `https://<vercel>`.
3. LiveKit Cloud → **Settings → Webhooks**: `https://<render>/api/calls/livekit-webhook` (без него эфир не узнает, что ведущий отключился, а звонки — что все вышли).

## 6. Проверка

Вход по паролю и через Google; публикация фото; директ между двумя аккаунтами в реальном времени; звонок; push (разрешить уведомления); эфир; админка (`alex.morgan`).

## Бесплатный Render засыпает

Через 15 минут без запросов сервис засыпает, первый запрос будит его ~50 с. Перед показом: cron-job.org (бесплатно) → GET `https://<render>/api/health` каждые 10 минут.
