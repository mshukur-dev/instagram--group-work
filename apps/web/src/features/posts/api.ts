import type { Page, Post } from '@instagram/shared';
import { api } from '@/lib/api';

export const getFeed = (cursor?: string) =>
  api.get<Page<Post>>('/feed', { params: { cursor } }).then((r) => r.data);
