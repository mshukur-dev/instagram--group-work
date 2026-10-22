import axios from 'axios';
import type { MediaSignature, UploadedMedia } from '@instagram/shared';
import { cldUrl } from './cloudinary';

type CloudinaryResponse = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  duration?: number;
  resource_type: 'image' | 'video' | 'raw';
};

type UploadOptions = {
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
};

// Direct upload with a signature from POST /api/media/signature (docs/spec/media.md).
// Plain axios, not `api`: this request goes to Cloudinary, without our cookies and interceptors.
export async function uploadToCloudinary(
  file: File,
  signature: MediaSignature,
  { onProgress, signal }: UploadOptions = {},
): Promise<UploadedMedia> {
  const body = new FormData();
  body.append('api_key', signature.apiKey);
  body.append('timestamp', String(signature.timestamp));
  body.append('signature', signature.signature);
  body.append('folder', signature.folder);
  // Must be sent exactly as signed
  if (signature.transformation) body.append('transformation', signature.transformation);
  body.append('file', file);

  const { data } = await axios.post<CloudinaryResponse>(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
    body,
    { signal, onUploadProgress: (event) => onProgress?.(event.loaded, event.total ?? file.size) },
  );

  const isVideo = data.resource_type === 'video';
  return {
    type: isVideo ? 'VIDEO' : 'IMAGE',
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    duration: isVideo ? data.duration : undefined,
    // First frame of a video as a JPG (docs/spec/media.md, section 3)
    thumbnailUrl: isVideo
      ? cldUrl(data.secure_url, 'so_0').replace(/\.[^./]+$/, '.jpg')
      : undefined,
  };
}
