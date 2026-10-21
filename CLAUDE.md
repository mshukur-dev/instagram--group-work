# CLAUDE.md

Instructions for Claude Code in this repository. Project docs are written in Russian; code, identifiers, comments and commit messages are in English. Reply to the developers in Russian.

## Project

Educational full copy of Instagram (web, **desktop-first**, UI in **English (default) and Russian**). Two developers, deadline Saturday 24.10.2026 evening.
Features: auth (email/password + Google), profiles, follows, private accounts, posts (carousel), feed, likes, comments, saves, search, explore, hashtags, stories, highlights, reels, direct messages (1:1 and groups), audio/video calls (1:1 and group), realtime notifications, browser push notifications (Web Push), settings.

## Read before working

| Task touches | Read |
|---|---|
| Anything (first time) | `docs/TZ.md`, `docs/spec/architecture.md` |
| `apps/api` | `docs/spec/backend.md` |
| `apps/web` | `docs/spec/frontend.md` |
| Auth, guards, cookies | `docs/spec/auth.md` |
| Database / Prisma | `docs/spec/database.md` |
| Endpoints | `docs/spec/api.md` |
| Direct, notifications, presence | `docs/spec/realtime.md` |
| Calls | `docs/spec/calls.md` |
| Uploads, images, video | `docs/spec/media.md` |
| Browser push, service worker, in-app alerts | `docs/spec/push.md` |
| Any user-facing text, errors, dates | `docs/spec/i18n.md` |
| Planning, what's next | `docs/ROADMAP.md` |

Requirement codes (`AUTH-1`, `STORY-3`, …) come from `docs/TZ.md`; use them in PR descriptions and issues.

## Team roles: "I am participant 1 / 2"

Two developers share this repo. When a developer says which participant they are ("я участник 1", "я участник 2"):

1. **Find their work** in `docs/ROADMAP.md`: the roles table and the section for today's date. If they didn't say who they are and the task is ambiguous, ask once.
2. **Check what is already done** before starting: the status table in `docs/ROADMAP.md`, `git log origin/main --oneline -20`, open branches / PRs. Never redo finished work.
3. **Propose the next task** from their list (P0 before P1 before P2, see `docs/TZ.md`) and start it after they agree.
4. **Stay in their lane:** only touch files of their own tasks. Shared files (`schema.prisma`, `packages/shared`, `apps/web/src/components/ui`, layouts, `app.module.ts`, `messages/*.json` structure) — keep changes minimal and tell the developer to warn the teammate.
5. **One task = one branch = one PR** (`feature/<task>`), named after requirement codes.
6. **When a task is done:** tests and lint pass, spec updated if behavior changed, status in `docs/ROADMAP.md` updated in the same PR, and a short summary in Russian of what was done and how to check it.

## Stack

- Monorepo: pnpm workspaces + Turborepo. Node 24.
- `apps/web`: Next.js (App Router), TypeScript, Tailwind CSS + shadcn/ui, Axios, TanStack Query, Zustand, react-hook-form + zod, socket.io-client, LiveKit client.
- `apps/api`: NestJS, Prisma + PostgreSQL, Passport (JWT + Google OAuth), argon2, Socket.IO, Cloudinary, livekit-server-sdk.
- `packages/shared` (`@instagram/shared`): zod schemas, response types, constants, socket event names — used by both apps. No React/NestJS code here.
- `packages/config` (`@instagram/config`): shared tsconfig / eslint / prettier.

## Hard rules

1. **Spec is the source of truth.** If code must diverge from `docs/spec/*`, update the spec in the same change and say so.
2. **Validation via zod schemas from `@instagram/shared`** on both sides (`ZodValidationPipe` in API, `zodResolver` in forms). No class-validator.
3. **API endpoints are private by default** (global `JwtAuthGuard`); public ones use `@Public()`. Permission checks live in services.
4. **Never expose** `passwordHash`, `googleId`, `refreshTokenHash` or other users' emails — map Prisma entities to DTOs.
5. **Counters** (`likesCount`, `followersCount`, …) change in the same `prisma.$transaction` as the action.
6. **Lists use cursor pagination**: `{ items, nextCursor }`.
7. **Frontend state:** server data only in TanStack Query (via hooks in `features/*/queries.ts`); Zustand only for client UI state. Never copy API data into Zustand. Socket events update the Query cache.
8. **Components never call Axios directly** — only through `features/*/queries.ts` hooks.
9. **Media uploads go directly to Cloudinary** with a signature from `POST /api/media/signature`; display through `cldUrl()` with sized transforms.
10. **Socket event names** come from `packages/shared/src/socket-events.ts`, never string literals.
11. **Prisma schema changes** only via migrations; the schema is shared between both developers — keep changes small and mention them.
12. **Desktop-first** Tailwind: base classes describe desktop, mobile via `max-xl:` / `max-md:` variants. Colors/spacing via theme tokens, no hardcoded hex in components. Visual style: faithful Instagram copy (see `docs/design.md` once it exists).
13. TypeScript strict, no `any`.
14. **Two UI languages via `next-intl`: English (default) and Russian.** No hardcoded strings in components (including placeholders, aria-labels, toasts) — always `t('key')`, and every new key goes into **both** `apps/web/messages/en.json` and `ru.json` (Russian plurals: one/few/many). API errors carry a `code` from `ErrorCode` in `@instagram/shared`; the frontend translates by code. Notifications and system messages are stored as type + data, never as ready text. Push texts are built on the backend in the recipient's `User.language`.
15. **Direct messages are sent via REST** (`POST /conversations/:id/messages`) with optimistic UI; Socket.IO only delivers them to other members. Don't move sending to sockets.
16. Side effects (notification, socket emit, web push) run after the main write; never notify the actor about their own action.

## Commands

```bash
pnpm install          # install all workspaces
pnpm db:up            # start PostgreSQL + LiveKit (Docker)
pnpm dev              # run web (3000) and api (4000)
pnpm lint             # lint all
pnpm typecheck        # typecheck all
pnpm --filter api prisma migrate dev --name <name>
pnpm --filter api prisma studio
```

## Git

Branches `feature/*`, `fix/*`, `docs/*`, `chore/*` from `main`; Conventional Commits in English; PRs into `main` with requirement codes. See `CONTRIBUTING.md`.
