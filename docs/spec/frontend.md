# Фронтенд (apps/web, Next.js)

> Дизайн и визуальный стиль описываются отдельно в `docs/design.md` (будет добавлен после обсуждения). Общий принцип: **копия Instagram, desktop-first, интерфейс на английском (основной) и русском** — см. [i18n.md](./i18n.md).

## 1. Структура

```
apps/web/src/
├── app/                         роутинг (App Router)
│   ├── (auth)/                  страницы без навигации
│   │   └── accounts/
│   │       ├── login/
│   │       ├── emailsignup/
│   │       └── onboarding/      выбор username после входа через Google
│   ├── (main)/                  страницы с навигацией (layout с меню)
│   │   ├── page.tsx             /            лента
│   │   ├── explore/             /explore     и /explore/tags/[tag]
│   │   ├── reels/               /reels
│   │   ├── direct/              /direct/inbox, /direct/t/[id]
│   │   ├── notifications/       /notifications (мобильная версия)
│   │   ├── p/[id]/              /p/:id       пост страницей (прямая ссылка, перезагрузка); внутри приложения пост открывается модалкой сразу по клику (PostModalHost в layout, адрес меняется через history.pushState)
│   │   ├── reel/[id]/           /reel/:id
│   │   ├── accounts/            настройки (layout с меню разделов слева; /accounts на телефоне — список разделов): edit, notifications, privacy, blocked, archive, messages, appearance, language, password, sessions
│   │   │   ├── edit/            Edit profile
│   │   │   ├── notifications/   Notifications
│   │   │   ├── privacy/         Privacy (закрытый аккаунт, кто пишет, статус «в сети»)
│   │   │   ├── password/        Password & security
│   │   │   ├── sessions/        Where you're logged in
│   │   │   ├── appearance/      тема
│   │   │   ├── language/        English / Русский
│   │   │   └── blocked/         заблокированные
│   │   ├── archive/stories/     архив Stories
│   │   ├── admin/               /admin (дашборд), /admin/users, /admin/content, /admin/log — только role = ADMIN (ADMIN-*): AdminShell отдаёт обычный 404 всем остальным, заголовок вкладки ставится только админу; пункт «Admin» в Sidebar виден только админу
│   │   ├── [username]/          профиль: /, /reels, /tagged, /saved
│   │   └── @modal/(.)stories/[username]/  просмотрщик Stories поверх текущей страницы (переход внутри приложения)
│   ├── stories/[username]/      просмотрщик Stories отдельной страницей (прямая ссылка, перезагрузка)
│   └── layout.tsx               провайдеры: QueryClient, тема, сокет
├── proxy.ts                     редирект неавторизованных на логин (в Next.js 16 так называется бывший middleware.ts)
├── components/
│   ├── ui/                      базовые: Button, Input, Avatar, Modal, Spinner (shadcn)
│   └── layout/                  Sidebar, BottomNav, Header
├── features/                    вся логика по фичам
│   ├── auth/
│   ├── profile/
│   ├── posts/
│   │   ├── api.ts               функции запросов: getFeed, createPost, likePost…
│   │   ├── queries.ts           хуки: useFeed, useLikePost…
│   │   └── components/          PostCard, PostMedia, CreatePostModal…
│   ├── comments/
│   ├── stories/
│   ├── reels/
│   ├── explore/
│   ├── search/
│   ├── direct/
│   ├── calls/
│   ├── notifications/
│   ├── push/                    подписка на Web Push, баннер «Turn on notifications»
│   └── settings/
├── lib/
│   ├── api.ts                   экземпляр Axios + interceptors
│   ├── query-client.ts
│   ├── query-keys.ts            все ключи кэша в одном месте
│   ├── socket.ts                Socket.IO клиент
│   ├── cloudinary.ts            загрузка и cldUrl()
│   └── utils.ts
└── stores/                      Zustand
    ├── call-store.ts
    ├── ui-store.ts              открытые модалки, панели поиска/уведомлений
    └── player-store.ts          звук в Reels/видео вкл/выкл

apps/web/public/
├── sw.js                        Service Worker для push-уведомлений (см. push.md)
└── sounds/                      рингтон, звук сообщения

apps/web/messages/
├── en.json                      тексты интерфейса на английском (основной)
└── ru.json                      те же ключи на русском (см. i18n.md)
```

**Правило:** код фичи живёт в `features/<фича>/`. Страница в `app/` только собирает компоненты фич, логики в ней нет.

## 2. Два вида состояния

| Состояние | Примеры | Где хранится |
|---|---|---|
| **Серверное** — данные из API | лента, профиль, комментарии, чаты, уведомления | **TanStack Query** |
| **Клиентское** — только в браузере | открыта ли модалка, активный звонок, звук вкл/выкл | **Zustand** |

**Главное правило:** данные из API **никогда** не копируются в Zustand. Если нужно обновить данные (лайк, новое сообщение) — обновляем кэш TanStack Query.

## 3. Запросы: Axios + TanStack Query

### Слой 1: Axios (`lib/api.ts`)

```ts
export const api = axios.create({ baseURL: '/api', withCredentials: true });
// interceptor: 401 → один общий POST /auth/refresh → повтор запроса;
// refresh не удался → queryClient.clear() + redirect на /accounts/login
```

### Слой 2: функции запросов (`features/*/api.ts`)

```ts
export const getFeed = (cursor?: string) =>
  api.get<Page<Post>>('/feed', { params: { cursor } }).then((r) => r.data);
```

### Слой 3: хуки (`features/*/queries.ts`)

```ts
export const useFeed = () =>
  useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: ({ pageParam }) => getFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
```

Компоненты используют **только хуки**, а не `api` напрямую.

### Оптимистичные обновления

Лайк, сохранение, подписка обновляются в UI **сразу**, до ответа сервера. При ошибке изменение откатывается (`onMutate` → `onError` → `onSettled`). Так интерфейс ощущается мгновенным, как в настоящем Instagram.

### Ключи кэша (`lib/query-keys.ts`)

```ts
export const queryKeys = {
  me: () => ['me'],
  feed: () => ['feed'],
  post: (id: string) => ['post', id],
  profile: (username: string) => ['profile', username],
  profilePosts: (username: string) => ['profile', username, 'posts'],
  comments: (postId: string) => ['comments', postId],
  conversations: () => ['conversations'],
  messages: (conversationId: string) => ['messages', conversationId],
  notifications: () => ['notifications'],
  // ...
};
```

## 4. Формы

`react-hook-form` + `zodResolver(schema)`, где `schema` импортируется из `@instagram/shared`. Ошибки сервера (409 «username занят») показываются у соответствующего поля.

## 5. Компоненты и стили

- **Tailwind CSS** + компоненты **shadcn/ui** как основа (`components/ui`).
- Цвета, отступы, радиусы — только через токены темы (CSS-переменные), без «магических» значений вроде `#262626` прямо в компонентах. Так работает светлая/тёмная тема.
- **Desktop-first:** обычные классы описывают десктоп, а мобильная версия добавляется через `max-*`-варианты Tailwind:
  ```tsx
  <aside className="w-[244px] max-xl:w-[72px] max-md:hidden">
  ```
  `max-xl:` — экран уже 1280px, `max-md:` — уже 768px (телефон).
- **Никакого текста прямо в компонентах** — только `t('key')` из `next-intl`, ключи сразу в `en.json` и `ru.json`. Английские тексты — как в оригинальном Instagram: `Log in`, `Follow`, `Message`, `No posts yet`. Подробнее в [i18n.md](./i18n.md).
- Иконки: `lucide-react` (или SVG-иконки Instagram в `components/icons`).
- Картинки и видео — через `cldUrl()` с нужным размером, никогда не грузим оригинал в сетку.

## 6. Навигация (как в Instagram)

Описано от основного вида (десктоп) к мобильному:

| Ширина | Навигация |
|---|---|
| ≥ 768px (основной вид) | Плавающая панель из иконок (80px, отступ 20px от левого края, мягкая тень `shadow-float`): Home, Search, Reels, Messages, Notifications, Create, Profile, More (меню над кнопкой: Settings, Saved, Switch appearance — вторая страница с переключателем тёмной темы, Log out). При наведении или фокусе с клавиатуры плавно (Motion) раскрывается поверх страницы до 256px с подписями и оригинальной надписью-логотипом (SVG `components/icons/instagram-wordmark.tsx`, цвет по теме). При наведении одна подсветка плавно скользит за курсором от пункта к пункту (Motion `layoutId`); активный пункт — жирная иконка и едва заметная подложка |
| < 768px (телефон) | Шапка сверху (логотип, уведомления, директ) + нижнее меню: Home, Search, Create, Reels, Profile |

Поиск — отдельная страница `/explore/search` (на телефоне — пункт нижнего меню): поле, недавние запросы, найденные аккаунты и хэштеги, при вводе — вкладки «Топ», «Аккаунты», «Reels», «Хэштеги», «Места» (SEARCH-5; запрос с `#` открывается на «Хэштегах»); без запроса — блок «Топ» — сетка 3 колонки из популярных постов и Reels: каждые две строки — один Reel (плитка в две строки, то слева, то справа) и четыре поста. Двойной тап по Reel и по посту показывает одно и то же градиентное сердце. Админу на телефоне в нижнем меню доступна ссылка на `/admin`. Уведомления на десктопе открываются панелью поверх меню с крестиком в углу, на телефоне — отдельной страницей `/notifications`.

## 7. Уведомления внутри сайта

- Всплывающие уведомления — `sonner`; звук нового сообщения — `public/sounds/`.
- Заголовок вкладки `(N) Instagram` обновляется хуком `useDocumentTitleCounter()` из суммы непрочитанных переписок и уведомлений.
- При смене фокуса вкладки (`visibilitychange`, `focus`, `blur`) фронт шлёт `presence:focus` — сервер решает, нужен ли системный push (см. [push.md](./push.md)).

## 8. Основные зависимости

`next`, `react`, `typescript`, `tailwindcss`, шрифт Inter (`next/font`, латиница + кириллица), `next-intl`, `axios`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `socket.io-client`, `livekit-client`, `@livekit/components-react`, `react-easy-crop`, `embla-carousel-react` (карусель), `react-intersection-observer` (бесконечная прокрутка, автоплей Reels), `date-fns` («2 ч. назад»), `lucide-react`, `sonner` (тосты), `motion` (анимации: раскрытие меню, сердечко при двойном тапе, Stories; простые hover-эффекты — классами Tailwind).

## Конец ленты (FEED-2)

Когда посты подписок закончились, лента не обрывается (`features/posts/components/feed-end.tsx`):

1. **«Вы всё посмотрели»** — кольцо в цветах историй с галочкой (рисуется один раз, когда блок появляется на экране), по бокам линии: граница между своей лентой и рекомендациями.
2. **«Рекомендуемые публикации»** — `GET /explore` (популярные посты открытых аккаунтов, на которые я не подписан), бесконечно, только фото-посты, без уже показанных. Ключ `['feed', 'suggested']` — внутри `feed`, поэтому лайки и сохранения обновляют его как ленту.
3. **Ничего не подписан** — вместо «Нет публикаций»: приветствие и карусель карточек людей с кнопкой «Подписаться» (`GET /users/suggestions`), ниже те же рекомендации.
