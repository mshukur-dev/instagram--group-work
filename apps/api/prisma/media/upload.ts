/**
 * Step 2 of the demo media: copies everything in manifest.json to our Cloudinary (Cloudinary
 * fetches each file from Pixabay itself, nothing is downloaded here) and writes library.json,
 * which the seed reads. Safe to re-run: what is already in library.json is skipped.
 *   node --env-file=.env -r ts-node/register/transpile-only prisma/media/upload.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ManifestItem } from './collect';

const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } =
  process.env;
if (!cloud || !apiKey || !secret) throw new Error('CLOUDINARY_* is missing in apps/api/.env');

export type LibraryItem = {
  kind: ManifestItem['kind'];
  topic: string;
  tags: string[];
  url: string;
  publicId: string;
  width: number;
  height: number;
  duration?: number;
};

const manifestPath = join(__dirname, 'manifest.json');
const libraryPath = join(__dirname, 'library.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestItem[];
const library: Record<string, LibraryItem> = existsSync(libraryPath)
  ? (JSON.parse(readFileSync(libraryPath, 'utf8')) as Record<string, LibraryItem>)
  : {};

const keyOf = (item: ManifestItem) => `${item.kind}_${item.pixabayId}`;

async function upload(item: ManifestItem): Promise<LibraryItem> {
  const resource = item.kind === 'video' ? 'video' : 'image';
  const params: Record<string, string> = {
    folder: `instagram/seed/${item.kind === 'video' ? 'reels' : item.kind === 'story' ? 'stories' : 'posts'}`,
    public_id: `${item.topic}_${item.pixabayId}`,
    overwrite: 'false',
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = createHash('sha1').update(toSign + secret).digest('hex');
  const body = new URLSearchParams({ ...params, file: item.src, api_key: apiKey!, signature });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resource}/upload`, {
    method: 'POST',
    body,
  });
  const json = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    width?: number;
    height?: number;
    duration?: number;
    error?: { message: string };
  };
  if (!res.ok || !json.secure_url) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return {
    kind: item.kind,
    topic: item.topic,
    tags: item.tags,
    url: json.secure_url,
    publicId: json.public_id!,
    width: json.width ?? item.width,
    height: json.height ?? item.height,
    duration: json.duration ? Math.round(json.duration * 10) / 10 : item.duration,
  };
}

async function main(): Promise<void> {
  const todo = manifest.filter((item) => !library[keyOf(item)]);
  console.log(`${todo.length} to upload, ${Object.keys(library).length} already there`);
  let done = 0;
  let failed = 0;
  const save = () => writeFileSync(libraryPath, JSON.stringify(library, null, 1));

  // A few at a time: Cloudinary fetches each file from Pixabay
  const queue = [...todo];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        library[keyOf(item)] = await upload(item);
        done++;
      } catch (error) {
        failed++;
        console.warn(`✗ ${keyOf(item)}: ${(error as Error).message}`);
      }
      if ((done + failed) % 25 === 0) {
        save();
        console.log(`… ${done + failed}/${todo.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  save();
  console.log(`Done: ${done} uploaded, ${failed} failed, library has ${Object.keys(library).length}`);
}

void main();
