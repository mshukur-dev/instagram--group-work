import type { Page, Story, StoryTray, UserPreview } from '@instagram/shared';
import { getMediaSignature } from '@/features/posts/api';
import { api } from '@/lib/api';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';

export const getStoriesFeed = () => api.get<StoryTray[]>('/stories/feed').then((r) => r.data);

export const getUserStories = (username: string) =>
  api.get<Story[]>(`/users/${username}/stories`).then((r) => r.data);

/** STORY like: the author gets a notification (not a message) */
export const likeStory = (id: string, liked: boolean) =>
  (liked ? api.post(`/stories/${id}/like`) : api.delete(`/stories/${id}/like`)).then(
    () => undefined,
  );

export const viewStory = (id: string) => api.post(`/stories/${id}/view`).then(() => undefined);

// The file goes straight to Cloudinary (docs/spec/media.md), then the story is created from it
export async function createStory(file: File) {
  const signature = await getMediaSignature({ folder: 'stories' });
  const uploaded = await uploadToCloudinary(file, signature);
  return api.post<Story>('/stories', uploaded).then((r) => r.data);
}

export type StoryViewer = UserPreview & { liked: boolean };

/** STORY-5: who has seen my story (author only). */
export const getStoryViewers = (id: string, cursor?: string) =>
  api.get<Page<StoryViewer>>(`/stories/${id}/viewers`, { params: { cursor } }).then((r) => r.data);
