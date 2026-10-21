# Правила работы

## Ветки

- `main` — всегда рабочая версия. Напрямую в `main` не пушим.
- Под каждую задачу — своя ветка от свежего `main`:

| Префикс | Для чего | Пример |
|---|---|---|
| `feature/` | новая функция | `feature/stories-viewer` |
| `fix/` | исправление бага | `fix/feed-duplicates` |
| `docs/` | документация | `docs/update-api-spec` |
| `chore/` | настройка, зависимости | `chore/setup-ci` |

```bash
git checkout main
```

```bash
git pull
```

```bash
git checkout -b feature/stories-viewer
```

## Коммиты

Формат [Conventional Commits](https://www.conventionalcommits.org/), сообщение на английском:

```
feat(stories): add story viewer with progress bars
fix(feed): prevent duplicate posts on refetch
docs(spec): describe call webhooks
chore: add prettier config
```

Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. В скобках — модуль.

## Pull Request

1. Запушить ветку, открыть PR в `main`.
2. В описании: что сделано, коды требований из ТЗ (`STORY-1, STORY-3`), как проверить.
3. Проверки CI (lint, typecheck, build) должны пройти.
4. Напарник смотрит PR и одобряет. Если напарник недоступен, а задача срочная — можно слить самому, но написать ему.
5. Слияние через **Squash and merge**.

## Задачи

- Каждая задача — GitHub Issue с кодом требования в названии: `[STORY-3] Просмотрщик Stories`.
- Доска GitHub Projects: **To Do → In Progress → Review → Done**.
- Взял задачу — назначь себя и перетащи в In Progress.

## Как не мешать друг другу

- Каждый работает в модулях своего трека (см. [ROADMAP.md](docs/ROADMAP.md)).
- **Общие файлы** (`schema.prisma`, `packages/shared`, `components/ui`, layout, `app.module.ts`) меняем маленькими отдельными PR и предупреждаем напарника.
- Подтягивай `main` в свою ветку хотя бы раз в несколько часов: `git pull origin main`.

## Документация

Изменил поведение, API или схему БД — обнови соответствующий файл в `docs/spec/` **в том же PR**. Документация — это то, по чему работает AI у обоих.

## Секреты

`.env` в Git не коммитим никогда. Новые переменные добавляем в `.env.example` без значений, а сами значения передаём друг другу лично.
