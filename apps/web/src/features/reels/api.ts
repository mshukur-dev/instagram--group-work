import type { Page, Post } from '@instagram/shared';
import { api } from '@/lib/api';

export const getReels = (cursor?: string) =>
  api.get<Page<Post>>('/reels', { params: { cursor } }).then((r) => r.data);

/** REELS-5: +1 view (the server ignores my own reels) */
export const viewReel = (id: string) => api.post(`/posts/${id}/view`).then(() => undefined);
