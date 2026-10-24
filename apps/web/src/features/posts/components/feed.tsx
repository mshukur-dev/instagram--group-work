'use client';

import type { Post } from '@instagram/shared';
import { isAxiosError } from 'axios';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { useFeed } from '../queries';
import { CaughtUp, SuggestedPosts, Welcome } from './feed-end';
import { PostCard } from './post-card';
import { mediaKey, uniqueByMedia } from '@/lib/unique-media';

function PostSkeleton() {
  return (
    <div className="animate-pulse space-y-3 max-md:px-3">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-muted" />
        <div className="h-3 w-32 rounded bg-muted" />
      </div>
      <div className="aspect-4/5 rounded-sm bg-muted" />
      <div className="h-3 w-24 rounded bg-muted" />
    </div>
  );
}

// FEED-1, FEED-2: posts from followed accounts, loads more on scroll. When they run out the feed
// goes on with suggested posts (feed-end.tsx), so it never just stops.
export function Feed() {
  const t = useTranslations('feed');
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();
  const { ref, inView } = useInView({ rootMargin: '600px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (error) {
    const notLoggedIn = isAxiosError(error) && error.response?.status === 401;
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {t(notLoggedIn ? 'loginRequired' : 'error')}
      </p>
    );
  }

  return (
    <FeedPosts
      posts={data.pages.flatMap((page) => page.items)}
      more={hasNextPage}
      fetching={isFetchingNextPage}
      sentinel={ref}
    />
  );
}

function FeedPosts({
  posts,
  more,
  fetching,
  sentinel,
}: {
  posts: Post[];
  more: boolean;
  fetching: boolean;
  /** Seen near the bottom: load the next page of followed posts */
  sentinel: (node?: Element | null) => void;
}) {
  const unique = useMemo(() => uniqueByMedia(posts), [posts]);
  // Suggestions skip what is already above (same post or same picture)
  const shown = useMemo(
    () => new Set([...unique.map((post) => post.id), ...unique.map(mediaKey)]),
    [unique],
  );
  return (
    <>
      {posts.length === 0 ? <Welcome /> : null}
      <div className="space-y-5">
        {unique.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        <div ref={sentinel} />
        {fetching && <PostSkeleton />}
      </div>
      {!more && (
        <>
          {posts.length > 0 && <CaughtUp />}
          <SuggestedPosts hide={shown} />
        </>
      )}
    </>
  );
}
