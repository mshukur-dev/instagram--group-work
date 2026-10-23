import type { Place, UploadedMedia } from '@instagram/shared';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { createPost, getMediaSignature } from '../api';
import { canEdit, cropArea, cropTransformation, type DraftMedia } from './draft';
import { bakeEdit, isEdited } from './filters';

type PublishInput = {
  items: DraftMedia[];
  /** Chosen crop shape, width / height */
  aspect: number;
  caption: string;
  /** Where it was taken, picked from the location search */
  location: Place | null;
  /** Already uploaded files by draft id: a retry does not upload them twice */
  uploaded: Map<string, UploadedMedia>;
  /** 0..1 */
  onProgress: (progress: number) => void;
};

// Upload takes most of the bar; the last slice is the POST /posts request
const UPLOAD_SHARE = 0.94;

export async function publishPost({
  items,
  aspect,
  caption,
  location,
  uploaded,
  onProgress,
}: PublishInput) {
  // Edited photos are painted onto a canvas first (already cropped, with the filter in);
  // the rest go as they are, cropped by Cloudinary on upload
  const sources = await Promise.all(
    items.map(async (item) => {
      if (uploaded.has(item.id) || !canEdit(item) || !isEdited(item.edit)) {
        return { file: item.file, transformation: cropTransformation(item, aspect) };
      }
      const file = await bakeEdit(item.url, cropArea(item, aspect), item.edit, item.file.name);
      return { file, transformation: undefined };
    }),
  );

  const totalBytes = sources.reduce((sum, source) => sum + source.file.size, 0);
  const loaded = new Map<string, number>(
    items.map((item, i) => [item.id, uploaded.has(item.id) ? (sources[i]?.file.size ?? 0) : 0]),
  );
  const report = () => {
    const done = [...loaded.values()].reduce((sum, value) => sum + value, 0);
    onProgress((done / totalBytes) * UPLOAD_SHARE);
  };
  report();

  const media = await Promise.all(
    items.map(async (item, i) => {
      const cached = uploaded.get(item.id);
      if (cached) return cached;
      const { file, transformation } = sources[i] ?? { file: item.file, transformation: undefined };

      const signature = await getMediaSignature({ folder: 'posts', transformation });
      const result = await uploadToCloudinary(file, signature, {
        onProgress: (bytes) => {
          loaded.set(item.id, Math.min(bytes, file.size));
          report();
        },
      });
      uploaded.set(item.id, result);
      loaded.set(item.id, file.size);
      report();
      return result;
    }),
  );

  const post = await createPost({
    type: 'POST',
    caption: caption.trim() || undefined,
    location: location ?? undefined,
    media,
  });
  onProgress(1);
  return post;
}
