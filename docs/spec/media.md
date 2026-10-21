# Медиа (Cloudinary)

Требования: `POST-1`, `POST-2`, `STORY-1`, `REELS-1`, `DM-4`, `NFR-7` в [TZ.md](../TZ.md).

## 1. Схема загрузки: напрямую в Cloudinary

```
1. Фронт: POST /api/media/signature { folder: 'posts' }
          → { signature, timestamp, apiKey, cloudName, folder }
2. Фронт: загружает файл НАПРЯМУЮ в Cloudinary с этой подписью
          (https://api.cloudinary.com/v1_1/<cloud>/auto/upload), показывает прогресс
          → Cloudinary возвращает { secure_url, public_id, width, height, duration, resource_type }
3. Фронт: POST /api/posts { media: [...то, что вернул Cloudinary] }
4. API: проверяет, что publicId лежит в нашей папке, сохраняет в БД
```

**Почему не через наш сервер:** видео до 100 МБ, прогонять его через NestJS — двойной трафик и нагрузка. Подпись гарантирует, что загружать в наш Cloudinary могут только наши авторизованные пользователи.

## 2. Папки и ограничения

| Папка | Что | Типы | Лимит |
|---|---|---|---|
| `instagram/avatars` | аватары, аватары групп | фото | 10 МБ |
| `instagram/posts` | посты (карусель) | фото, видео | фото 10 МБ, видео 100 МБ / 60 с |
| `instagram/reels` | Reels | видео | 100 МБ / 90 с |
| `instagram/stories` | Stories | фото, видео | 100 МБ / 60 с |
| `instagram/messages` | фото и видео в директе | фото, видео | 100 МБ |

Лимиты лежат в `packages/shared/src/constants` и проверяются на фронте **до** загрузки, а на бэке — по данным, которые вернул Cloudinary.

## 3. Показ: трансформации по URL

Cloudinary меняет размер и формат «на лету», если вставить параметры в URL. Хелпер `cldUrl(url, options)` в `apps/web/src/lib/cloudinary.ts`:

| Где | Трансформация |
|---|---|
| Сетка профиля / Explore | `c_fill,w_400,h_400,f_auto,q_auto` (квадрат) |
| Лента | `w_1080,f_auto,q_auto` |
| Аватар | `c_fill,w_150,h_150,f_auto,q_auto` |
| Превью видео (poster) | URL видео с расширением `.jpg` + `so_0` (первый кадр) |
| Видео | `f_auto,q_auto` (Cloudinary выбирает формат под браузер) |

`f_auto,q_auto` — автоматический формат (WebP/AVIF) и качество. Это сильно ускоряет загрузку ленты.

## 4. Обрезка фото (POST-2)

Обрезка делается на фронте библиотекой `react-easy-crop`: пользователь выбирает 1:1, 4:5 или 16:9 и область. Координаты обрезки передаются в Cloudinary как трансформация при загрузке (`c_crop,x,y,w,h`), а не через canvas. Строку трансформации фронт передаёт в `POST /api/media/signature { folder, transformation }` — она входит в подпись, и затем отправляется в Cloudinary без изменений вместе с остальными параметрами.

## 5. Удаление

При удалении поста, Story или аватара API удаляет файлы из Cloudinary (`cloudinary.uploader.destroy(publicId)`) асинхронно, не задерживая ответ пользователю.

В коде: `MediaService.destroy(publicIds: string[])` из `MediaModule` (импортировать модуль в свой `*.module.ts`). Не ждёт результата, ничего не делает без ключей Cloudinary и пропускает id вне папки `instagram/` (seed). Тип ресурса определяется сам (сначала image, потом video). Проверка загруженных файлов перед сохранением — `MediaService.assertUploaded(items, { folders, maxVideoSeconds })`.

## 6. Тестовые данные

Seed использует картинки с `picsum.photos` и `pravatar.cc`, а не Cloudinary. `cldUrl()` должен возвращать такие URL без изменений (трансформации применяются только к `res.cloudinary.com`).
