'use client';

import { isAxiosError } from 'axios';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useFeed } from '../queries';
import { PostCard } from './post-card';

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

// FEED-1, FEED-2: posts from followed accounts, loads more on scroll
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

  const posts = data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="space-y-5">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={ref} />
      {isFetchingNextPage && <PostSkeleton />}
    </div>
  );
}
