/**
 * Step 1 of the demo media: finds photos and short videos on Pixabay by topic and writes
 * prisma/media/manifest.json (what to upload). Run once:
 *   node --env-file=.env -r ts-node/register/transpile-only prisma/media/collect.ts
 * Needs PIXABAY_API_KEY in apps/api/.env. Pixabay content is free to use (Pixabay Content
 * License); we copy it to our Cloudinary in step 2 (upload.ts) instead of hotlinking.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPICS } from './topics';

const KEY = process.env.PIXABAY_API_KEY;
if (!KEY) throw new Error('PIXABAY_API_KEY is missing in apps/api/.env');

type VideoFile = { url: string; width: number; height: number; size: number; thumbnail: string };
type VideoHit = {
  id: number;
  tags: string;
  duration: number;
  views: number;
  likes: number;
  videos: { large: VideoFile; medium: VideoFile; small: VideoFile; tiny: VideoFile };
};
type ImageHit = {
  id: number;
  tags: string;
  likes: number;
  views: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  previewURL: string;
};

export type ManifestItem = {
  kind: 'image' | 'video' | 'story';
  topic: string;
  pixabayId: number;
  tags: string[];
  src: string;
  thumb: string;
  width: number;
  height: number;
  duration?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const query = new URLSearchParams({ key: KEY!, safesearch: 'true', per_page: '200', ...params });
  const res = await fetch(`https://pixabay.com/api/${path}?${query}`);
  if (!res.ok) throw new Error(`Pixabay ${res.status}: ${await res.text()}`);
  await sleep(700); // 100 requests a minute
  return ((await res.json()) as { hits: T[] }).hits;
}

// Generated pictures, cartoons and abstract loops look out of place in a photo feed
const ARTIFICIAL = /(ai|generated|anime|cartoon|animation|abstract|background|fantasy|illustration|3d|render|loop|digital art|christmas)/;
const looksReal = (tags: string) => !ARTIFICIAL.test(tags.toLowerCase());

const tagsOf = (tags: string) =>
  tags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

async function main(): Promise<void> {
  const items: ManifestItem[] = [];
  const seen = new Set<string>();
  const add = (item: ManifestItem) => {
    const key = `${item.kind === 'video' ? 'v' : 'i'}${item.pixabayId}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const topic of TOPICS) {
    const onTopic = (tags: string) => {
      const list = tagsOf(tags);
      return topic.keywords.some((k) => list.includes(k));
    };
    // Videos: 5–30 s, tall ones first, then the most liked
    const videos: VideoHit[] = [];
    for (const q of topic.videoQueries) {
      videos.push(...(await get<VideoHit>('videos/', { q, video_type: 'film', order: 'popular' })));
    }
    const usable = videos
      .filter((v) => v.duration >= 5 && v.duration <= 30 && looksReal(v.tags) && onTopic(v.tags))
      .map((v) => ({ v, file: v.videos.small.url ? v.videos.small : v.videos.tiny }))
      .filter(({ file }) => file.url && file.size < 12_000_000)
      // Popular first; a tall picture counts as a bonus (it fills Reels without a crop)
      .sort((a, b) => {
        const score = (x: { v: VideoHit; file: VideoFile }) =>
          x.v.likes * (x.file.height > x.file.width ? 2 : 1);
        return score(b) - score(a);
      });
    let taken = 0;
    for (const { v, file } of usable) {
      if (taken >= topic.videos) break;
      const before = seen.size;
      add({
        kind: 'video',
        topic: topic.id,
        pixabayId: v.id,
        tags: tagsOf(v.tags),
        src: file.url,
        thumb: file.thumbnail,
        width: file.width,
        height: file.height,
        duration: v.duration,
      });
      if (seen.size > before) taken++;
    }

    // Feed photos: the most liked, any orientation
    const photos: ImageHit[] = [];
    for (const q of topic.imageQueries) {
      photos.push(...(await get<ImageHit>('', { q, image_type: 'photo', order: 'popular' })));
    }
    taken = 0;
    for (const p of photos.filter((x) => looksReal(x.tags) && onTopic(x.tags)).sort((a, b) => b.likes - a.likes)) {
      if (taken >= topic.images) break;
      const before = seen.size;
      add({
        kind: 'image',
        topic: topic.id,
        pixabayId: p.id,
        tags: tagsOf(p.tags),
        src: p.largeImageURL,
        thumb: p.previewURL,
        width: p.imageWidth,
        height: p.imageHeight,
      });
      if (seen.size > before) taken++;
    }

    // Story photos: tall ones
    const tall = await get<ImageHit>('', {
      q: topic.imageQueries[0]!,
      image_type: 'photo',
      orientation: 'vertical',
      order: 'popular',
    });
    taken = 0;
    for (const p of tall.filter((x) => looksReal(x.tags) && onTopic(x.tags))) {
      if (taken >= topic.stories) break;
      const before = seen.size;
      add({
        kind: 'story',
        topic: topic.id,
        pixabayId: p.id,
        tags: tagsOf(p.tags),
        src: p.largeImageURL,
        thumb: p.previewURL,
        width: p.imageWidth,
        height: p.imageHeight,
      });
      if (seen.size > before) taken++;
    }

    const count = (kind: ManifestItem['kind']) =>
      items.filter((i) => i.topic === topic.id && i.kind === kind).length;
    console.log(
      `${topic.id.padEnd(10)} videos ${count('video')}  photos ${count('image')}  stories ${count('story')}`,
    );
  }

  writeFileSync(join(__dirname, 'manifest.json'), JSON.stringify(items, null, 1));
  console.log(`manifest.json: ${items.length} items`);
}

void main();
