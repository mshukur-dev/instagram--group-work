import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Page } from '@instagram/shared';
import type { CommentItem } from './api';

type Thread = InfiniteData<Page<CommentItem>>;

// Comments live in two kinds of lists: the top level of a post and the replies of one comment.
// Both are infinite queries, so every change goes through the same helpers.
const THREAD_KEYS = [['comments'], ['replies']] as const;

/** Runs `change` over the items of every cached comment list. */
function updateThreads(queryClient: QueryClient, change: (items: CommentItem[]) => CommentItem[]) {
  for (const queryKey of THREAD_KEYS) {
    queryClient.setQueriesData<Thread>({ queryKey }, (data) =>
      data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) }
        : data,
    );
  }
}

export function patchComment(
  queryClient: QueryClient,
  commentId: string,
  patch: (comment: CommentItem) => CommentItem,
) {
  updateThreads(queryClient, (items) => items.map((c) => (c.id === commentId ? patch(c) : c)));
}

export function removeComment(queryClient: QueryClient, commentId: string) {
  updateThreads(queryClient, (items) => items.filter((c) => c.id !== commentId));
}

/** Puts a new comment at the top of the post's list (newest first). */
export function prependComment(queryClient: QueryClient, postId: string, comment: CommentItem) {
  queryClient.setQueriesData<Thread>({ queryKey: ['comments', postId] }, (data) => {
    const [first, ...rest] = data?.pages ?? [];
    if (!data || !first) return data;
    return { ...data, pages: [{ ...first, items: [comment, ...first.items] }, ...rest] };
  });
}

/** Puts a reply at the bottom of its comment's replies (oldest first). Does nothing while the
 *  replies were never opened: the server list will contain the reply when they load. */
export function appendReply(queryClient: QueryClient, rootId: string, reply: CommentItem) {
  queryClient.setQueriesData<Thread>({ queryKey: ['replies', rootId] }, (data) => {
    const last = data?.pages.at(-1);
    if (!data || !last) return data;
    const pages = [...data.pages.slice(0, -1), { ...last, items: [...last.items, reply] }];
    return { ...data, pages };
  });
}

/** Optimistic update: changes all lists and returns a function that puts them back. */
export function withThreadRollback(queryClient: QueryClient, change: () => void) {
  const snapshots = THREAD_KEYS.flatMap((queryKey) =>
    queryClient.getQueriesData<Thread>({ queryKey }),
  );
  change();
  return () => snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/** Swaps a temporary comment for the one the server returned, keeping its React key. */
export function replaceComment(queryClient: QueryClient, tempId: string, saved: CommentItem) {
  updateThreads(queryClient, (items) =>
    items.map((c) => (c.id === tempId ? { ...saved, clientKey: c.clientKey ?? tempId } : c)),
  );
}
