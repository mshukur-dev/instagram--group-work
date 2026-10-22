import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Page, Post } from '@instagram/shared';
import { queryKeys } from '@/lib/query-keys';

type Feed = InfiniteData<Page<Post>>;

// Lists of posts: the feed and the grids of a profile (['profile', username, 'posts', tab]).
// Other ['profile', …] queries hold users, so grids are picked out by their key.
const isProfileGrid = (key: readonly unknown[]) => key[0] === 'profile' && key[2] === 'posts';

function mapLists(queryClient: QueryClient, change: (items: Post[]) => Post[]) {
  const apply = (data: Feed | undefined) =>
    data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) }
      : data;
  queryClient.setQueriesData<Feed>({ queryKey: queryKeys.feed() }, apply);
  queryClient.setQueriesData<Feed>(
    { queryKey: ['profile'], predicate: (query) => isProfileGrid(query.queryKey) },
    apply,
  );
}

/** Applies `patch` to one post everywhere it is cached (feed, profile grids, post page / modal). */
export function patchPost(queryClient: QueryClient, postId: string, patch: (post: Post) => Post) {
  mapLists(queryClient, (items) => items.map((post) => (post.id === postId ? patch(post) : post)));
  queryClient.setQueryData<Post>(queryKeys.post(postId), (post) => (post ? patch(post) : post));
}

/** Optimistic update: patches the caches and returns a function that puts them back. */
export function patchPostWithRollback(
  queryClient: QueryClient,
  postId: string,
  patch: (post: Post) => Post,
) {
  const lists = queryClient.getQueriesData<Feed>({
    predicate: (query) => query.queryKey[0] === 'feed' || isProfileGrid(query.queryKey),
  });
  const single = queryClient.getQueryData<Post>(queryKeys.post(postId));
  patchPost(queryClient, postId, patch);

  return () => {
    lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
    if (single) queryClient.setQueryData(queryKeys.post(postId), single);
  };
}

/** A deleted post disappears from every list. */
export function removePost(queryClient: QueryClient, postId: string) {
  mapLists(queryClient, (items) => items.filter((post) => post.id !== postId));
  queryClient.removeQueries({ queryKey: queryKeys.post(postId) });
}

/** The post as the feed or a profile grid already has it, to open the modal without waiting. */
export function findCachedPost(queryClient: QueryClient, postId: string): Post | undefined {
  const lists = queryClient.getQueriesData<Feed>({
    predicate: (query) => query.queryKey[0] === 'feed' || isProfileGrid(query.queryKey),
  });
  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      const found = page.items.find((post) => post.id === postId);
      if (found) return found;
    }
  }
  return undefined;
}
