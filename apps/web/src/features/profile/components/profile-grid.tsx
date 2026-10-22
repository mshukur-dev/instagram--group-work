'use client';

import type { Post } from '@instagram/shared';
import {
  Bookmark,
  Camera,
  Clapperboard,
  Copy,
  Heart,
  MessageCircle,
  Play,
  SquareUserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import type { ProfileTab } from '../api';
import { useProfile, useProfilePosts } from '../queries';

const emptyIcons = { posts: Camera, reels: Clapperboard, saved: Bookmark, tagged: SquareUserRound };

function Tile({ post, tall }: { post: Post; tall: boolean }) {
  const t = useTranslations('profile');
  const cover = post.media[0];
  const image = cover?.type === 'VIDEO' ? cover.thumbnailUrl : cover?.url;
  const isReel = post.type === 'REEL';
  const CornerIcon = post.media.length > 1 ? Copy : cover?.type === 'VIDEO' ? Clapperboard : null;

  return (
    <Link
      href={isReel ? `/reel/${post.id}` : `/p/${post.id}`}
      className={cn(
        'group relative block overflow-hidden bg-muted',
        tall ? 'aspect-9/16' : 'aspect-3/4',
      )}
    >
      {image && (
        <img
          src={cldUrl(
            image,
            tall ? 'c_fill,w_400,h_711,f_auto,q_auto' : 'c_fill,w_400,h_533,f_auto,q_auto',
          )}
          alt={post.caption ?? ''}
          loading="lazy"
          className="size-full object-cover"
        />
      )}

      {/* Overlays sit on the photo, so they stay white in both themes */}
      {tall ? (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
          <Play className="size-4 fill-white" />
          {post.viewsCount}
        </span>
      ) : (
        CornerIcon && (
          <CornerIcon className="absolute top-2 right-2 size-5 text-white drop-shadow" />
        )
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-7 bg-black/30 font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
        <span
          className="flex items-center gap-1.5"
          aria-label={t('likesCount', { count: post.likesCount })}
        >
          <Heart className="size-5 fill-white" />
          {post.likesCount}
        </span>
        <span
          className="flex items-center gap-1.5"
          aria-label={t('commentsCount', { count: post.commentsCount })}
        >
          <MessageCircle className="size-5 -scale-x-100 fill-white" />
          {post.commentsCount}
        </span>
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="aspect-3/4 animate-pulse bg-muted" />
      ))}
    </div>
  );
}

// PROFILE-2: posts of one tab in a 3-column grid, loads more on scroll
export function ProfileGrid({ username, tab }: { username: string; tab: ProfileTab }) {
  const t = useTranslations('profile');
  const { data: profile } = useProfile(username);
  // Someone else's /saved shows nothing: saved posts are private to their owner
  const allowed = tab !== 'saved' || profile?.isMe === true;
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useProfilePosts(username, tab, allowed);
  const { ref, inView } = useInView({ rootMargin: '600px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!allowed) return null;
  if (isPending) return <GridSkeleton />;

  if (error) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t('postsError')}</p>;
  }

  const posts = data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    const Icon = emptyIcons[tab];
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="grid size-15.5 place-items-center rounded-full border-2 border-foreground">
          <Icon className="size-8" strokeWidth={1.5} />
        </span>
        <p className="text-3xl font-extrabold max-md:text-xl">{t(`empty.${tab}`)}</p>
      </div>
    );
  }

  return (
    <>
      {/* The new tab's posts fade in softly instead of popping up */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-3 gap-1"
      >
        {posts.map((post) => (
          <Tile key={post.id} post={post} tall={tab === 'reels'} />
        ))}
      </motion.div>
      <div ref={ref} />
      {isFetchingNextPage && <GridSkeleton />}
    </>
  );
}
