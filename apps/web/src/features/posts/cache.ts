import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Page, Post } from '@instagram/shared';
import { queryKeys } from '@/lib/query-keys';

type Feed = InfiniteData<Page<Post>>;

/** Applies `patch` to one post everywhere it is cached (feed, post page / modal). */
export function patchPost(queryClient: QueryClient, postId: string, patch: (post: Post) => Post) {
  queryClient.setQueriesData<Feed>({ queryKey: queryKeys.feed() }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === postId ? patch(post) : post)),
          })),
        }
      : data,
  );
  queryClient.setQueryData<Post>(queryKeys.post(postId), (post) => (post ? patch(post) : post));
}

/** Optimistic update: patches the caches and returns a function that puts them back. */
export function patchPostWithRollback(
  queryClient: QueryClient,
  postId: string,
  patch: (post: Post) => Post,
) {
  const feeds = queryClient.getQueriesData<Feed>({ queryKey: queryKeys.feed() });
  const single = queryClient.getQueryData<Post>(queryKeys.post(postId));
  patchPost(queryClient, postId, patch);

  return () => {
    feeds.forEach(([key, data]) => queryClient.setQueryData(key, data));
    if (single) queryClient.setQueryData(queryKeys.post(postId), single);
  };
}
