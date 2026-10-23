'use client';

import { ErrorCode, type Post } from '@instagram/shared';
import { Copy, Heart, Loader2, MapPin, MessageCircle, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { cldUrl } from '@/lib/cloudinary';
import { getErrorCode } from '@/lib/api-error';
import { useLocation, useLocationPosts } from '../queries';
import { PostLink } from './post-link';

// The page of a place (/explore/locations/:id): a quiet header (name, address, how many
// posts) over every post tagged there, newest first.
export function LocationPage({ id }: { id: string }) {
  const t = useTranslations('location');
  const location = useLocation(id);
  const posts = useLocationPosts(id);
  const { ref, inView } = useInView({ rootMargin: '600px' });
  const items = useMemo(() => posts.data?.pages.flatMap((p) => p.items) ?? [], [posts.data]);

  useEffect(() => {
    if (inView && posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
  }, [inView, posts]);

  if (location.isError) {
    const gone = getErrorCode(location.error) === ErrorCode.NOT_FOUND;
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        {gone ? t('notFound') : t('loadFailed')}
      </p>
    );
  }

  const place = location.data;
  return (
    <div className="mx-auto w-full max-w-233.75 px-5 pt-8 pb-16 max-md:px-0 max-md:pt-0">
      <header className="mb-1 border-b border-border px-1 pt-6 pb-8 max-md:px-4 max-md:pt-6 max-md:pb-5">
        {place ? (
          <>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight wrap-break-word max-md:text-2xl">
              {place.name}
            </h1>
            {place.address && (
              <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>{place.address}</span>
              </p>
            )}
            <p className="mt-4 text-sm font-semibold">{t('posts', { count: place.postsCount })}</p>
          </>
        ) : (
          <div className="space-y-2.5">
            <div className="h-7 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        )}
      </header>

      {posts.isPending ? (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-3/4 animate-pulse bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {items.map((post) => (
            <Tile key={post.id} post={post} />
          ))}
        </div>
      )}
      <div ref={ref} className="flex justify-center py-6">
        {posts.isFetchingNextPage && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function Tile({ post }: { post: Post }) {
  const t = useTranslations('location');
  const cover = post.media[0];
  const image = cover?.type === 'VIDEO' ? cover.thumbnailUrl : cover?.url;
  const isReel = post.type === 'REEL';
  return (
    <PostLink
      postId={post.id}
      href={isReel ? `/reel/${post.id}` : undefined}
      modal={!isReel}
      data-post-origin={post.id}
      className="group relative block aspect-3/4 overflow-hidden bg-muted"
    >
      {image && (
        <img
          src={cldUrl(image, 'c_fill,w_400,h_533,f_auto,q_auto')}
          alt={post.caption ?? ''}
          loading="lazy"
          className="size-full object-cover"
        />
      )}
      {post.media.length > 1 ? (
        <Copy className="absolute top-2 right-2 size-5 text-white drop-shadow" />
      ) : (
        cover?.type === 'VIDEO' && (
          <Play className="absolute top-2 right-2 size-5 fill-white text-white drop-shadow" />
        )
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-7 bg-black/30 font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
        <span
          className="flex items-center gap-1.5"
          aria-label={t('likes', { count: post.likesCount })}
        >
          <Heart className="size-5 fill-white" />
          {post.likesCount}
        </span>
        <span
          className="flex items-center gap-1.5"
          aria-label={t('comments', { count: post.commentsCount })}
        >
          <MessageCircle className="size-5 -scale-x-100 fill-white" />
          {post.commentsCount}
        </span>
      </div>
    </PostLink>
  );
}
