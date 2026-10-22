import type { UploadedMedia } from '@instagram/shared';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { createPost, getMediaSignature } from '../api';
import { cropTransformation, type DraftMedia } from './draft';

type PublishInput = {
  items: DraftMedia[];
  /** Chosen crop shape, width / height */
  aspect: number;
  caption: string;
  /** Already uploaded files by draft id: a retry does not upload them twice */
  uploaded: Map<string, UploadedMedia>;
  /** 0..1 */
  onProgress: (progress: number) => void;
};

// Upload takes most of the bar; the last slice is the POST /posts request
const UPLOAD_SHARE = 0.94;

export async function publishPost({ items, aspect, caption, uploaded, onProgress }: PublishInput) {
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const loaded = new Map<string, number>(
    items.map((item) => [item.id, uploaded.has(item.id) ? item.file.size : 0]),
  );
  const report = () => {
    const done = [...loaded.values()].reduce((sum, value) => sum + value, 0);
    onProgress((done / totalBytes) * UPLOAD_SHARE);
  };
  report();

  const media = await Promise.all(
    items.map(async (item) => {
      const cached = uploaded.get(item.id);
      if (cached) return cached;

      const signature = await getMediaSignature({
        folder: 'posts',
        transformation: cropTransformation(item, aspect),
      });
      const result = await uploadToCloudinary(item.file, signature, {
        onProgress: (bytes) => {
          loaded.set(item.id, Math.min(bytes, item.file.size));
          report();
        },
      });
      uploaded.set(item.id, result);
      loaded.set(item.id, item.file.size);
      report();
      return result;
    }),
  );

  const post = await createPost({
    type: 'POST',
    caption: caption.trim() || undefined,
    media,
  });
  onProgress(1);
  return post;
}
