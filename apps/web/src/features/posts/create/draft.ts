import type { Area, Point } from 'react-easy-crop';
import {
  CAROUSEL_MAX_ITEMS,
  IMAGE_MAX_BYTES,
  POST_VIDEO_MAX_SECONDS,
  VIDEO_MAX_BYTES,
} from '@instagram/shared';
import { EDIT_RESET, type PhotoEdit } from './filters';

// Crop shapes offered for photos (POST-2). `value` is width / height.
export const ASPECTS = [
  { key: '1:1', value: 1 },
  { key: '4:5', value: 4 / 5 },
  { key: '16:9', value: 16 / 9 },
] as const;
export type AspectKey = (typeof ASPECTS)[number]['key'];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(',');

/** One photo or video in the post being created, plus its crop state. */
export type DraftMedia = {
  id: string;
  file: File;
  /** Object URL, revoked when the draft is dropped */
  url: string;
  type: 'IMAGE' | 'VIDEO';
  width: number;
  height: number;
  duration: number | null;
  crop: Point;
  zoom: number;
  /** Crop area as percentages of the image (for the preview) */
  areaPercent: Area | null;
  /** Crop area in source pixels (sent to Cloudinary) */
  areaPixels: Area | null;
  /** Filter and adjustments (photos only) */
  edit: PhotoEdit;
};

/** Photos get filters; a GIF would lose its animation, a video can't be painted */
export const canEdit = (item: DraftMedia) =>
  item.type === 'IMAGE' && item.file.type !== 'image/gif';

export type RejectReason = 'unsupported' | 'tooLarge' | 'tooLong' | 'tooMany';

export const CROP_RESET = { crop: { x: 0, y: 0 }, zoom: 1, areaPercent: null, areaPixels: null };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('video'));
    video.src = url;
  });
}

/** Checks the files against the limits and reads their size; the rest is reported as rejected. */
export async function prepareFiles(
  files: File[],
  alreadyAdded: number,
): Promise<{ accepted: DraftMedia[]; rejected: RejectReason[] }> {
  const accepted: DraftMedia[] = [];
  const rejected: RejectReason[] = [];

  for (const file of files) {
    if (alreadyAdded + accepted.length >= CAROUSEL_MAX_ITEMS) {
      rejected.push('tooMany');
      continue;
    }
    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      rejected.push('unsupported');
      continue;
    }
    if (file.size > (isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES)) {
      rejected.push('tooLarge');
      continue;
    }

    const url = URL.createObjectURL(file);
    try {
      let width: number;
      let height: number;
      let duration: number | null = null;
      if (isImage) {
        const image = await loadImage(url);
        width = image.naturalWidth;
        height = image.naturalHeight;
      } else {
        const video = await loadVideo(url);
        width = video.videoWidth;
        height = video.videoHeight;
        duration = video.duration;
        if (duration > POST_VIDEO_MAX_SECONDS) {
          URL.revokeObjectURL(url);
          rejected.push('tooLong');
          continue;
        }
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        url,
        type: isImage ? 'IMAGE' : 'VIDEO',
        width,
        height,
        duration,
        ...CROP_RESET,
        edit: EDIT_RESET,
      });
    } catch {
      URL.revokeObjectURL(url);
      rejected.push('unsupported');
    }
  }
  return { accepted, rejected };
}

/** The part of the photo the post shows, in source pixels */
export function cropArea(item: DraftMedia, aspect: number): Area {
  if (item.areaPixels) return item.areaPixels;
  // Never opened in the cropper: the largest centered area of the chosen shape
  const ratio = item.width / item.height;
  const width = ratio > aspect ? item.height * aspect : item.width;
  const height = ratio > aspect ? item.height : item.width / aspect;
  return { x: (item.width - width) / 2, y: (item.height - height) / 2, width, height };
}

/** Cloudinary incoming transformation for the chosen crop (docs/spec/media.md, section 4). */
export function cropTransformation(item: DraftMedia, aspect: number): string | undefined {
  if (item.type !== 'IMAGE') return undefined;
  if (!item.areaPixels && Math.abs(item.width / item.height - aspect) < 0.005) return undefined;
  const area = cropArea(item, aspect);
  return `c_crop,x_${Math.round(area.x)},y_${Math.round(area.y)},w_${Math.round(area.width)},h_${Math.round(area.height)}`;
}
