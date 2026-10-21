import type { StoryTray } from '@instagram/shared';
import { api } from '@/lib/api';

export const getStoriesFeed = () => api.get<StoryTray[]>('/stories/feed').then((r) => r.data);
