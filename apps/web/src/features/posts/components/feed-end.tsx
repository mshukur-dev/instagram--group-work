'use client';

import type { SuggestedUser, ViewerFollowStatus } from '@instagram/shared';
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { storyRing } from '@/components/story-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { UserAvatar } from '@/components/user-avatar';
import { useFollowUser, useSuggestions } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { useSuggestedPosts } from '../queries';
import { PostCard } from './post-card';
import { mediaKey, uniqueByMedia } from '@/lib/unique-media';

// FEED-2: what comes after the followed accounts' posts (docs/spec/frontend.md). Instagram's
// "You're all caught up" mark, then suggested posts that keep loading; with nothing followed yet,
// a welcome with people to follow above the same suggestions.

/** The ring in the story colors draws itself, then the check, once it scrolls into view */
export function CaughtUp() {
  const t = useTranslations('feed');
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.6 });
  const drawn = inView || reduceMotion;

  return (
    <section ref={ref} className="flex flex-col items-center py-12 text-center max-md:px-6">
      <div className="flex w-full items-center gap-6">
        {/* The line where your own feed ends and suggestions begin */}
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <svg viewBox="0 0 96 96" aria-hidden="true" className="size-24 shrink-0">
          <defs>
            <linearGradient id="caught-up-ring" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: 'var(--story-ring-1)' }} />
              <stop offset="0.35" style={{ stopColor: 'var(--story-ring-2)' }} />
              <stop offset="0.6" style={{ stopColor: 'var(--story-ring-3)' }} />
              <stop offset="0.85" style={{ stopColor: 'var(--story-ring-4)' }} />
              <stop offset="1" style={{ stopColor: 'var(--story-ring-5)' }} />
            </linearGradient>
          </defs>
          <motion.circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="url(#caught-up-ring)"
            strokeWidth="3"
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            initial={false}
            animate={{ pathLength: drawn ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.path
            d="M31 49.5 43 61l23-25"
            fill="none"
            stroke="url(#caught-up-ring)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: drawn ? 1 : 0, opacity: drawn ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.75 }}
          />
        </svg>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <h2 className="mt-5 text-xl">{t('caughtUp')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('caughtUpHint')}</p>
    </section>
  );
}

/** Nothing followed yet: a welcome and a row of people to follow */
export function Welcome() {
  const t = useTranslations('feed');
  const { data: people } = useSuggestions();

  return (
    <section className="pt-10 pb-4">
      <div className="px-6 text-center">
        <h2 className="text-xl font-semibold">{t('welcomeTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('welcomeHint')}</p>
      </div>
      {people && people.length > 0 && (
        <ul className="mt-6 flex snap-x gap-3 overflow-x-auto px-1 pb-2 scrollbar-none max-md:px-3">
          {people.map((user) => (
            <SuggestionCard key={user.id} user={user} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionCard({ user }: { user: SuggestedUser }) {
  const t = useTranslations('feed');
  const tProfile = useTranslations('profile');
  const follow = useFollowUser();
  // Answers at once; the server's answer (Following / Requested) replaces the guess
  const [status, setStatus] = useState<ViewerFollowStatus>('NONE');
  const following = status !== 'NONE';
  const ring = storyRing(user);

  const toggle = () => {
    const previous = status;
    const next = !following;
    setStatus(next ? 'ACCEPTED' : 'NONE');
    follow.mutate(
      { username: user.username, follow: next },
      { onSuccess: (saved) => setStatus(saved), onError: () => setStatus(previous) },
    );
  };

  const reason = user.followedBy
    ? t('followedBy', { username: user.followedBy.username, others: user.followedBy.others })
    : t('popular');

  return (
    <li className="flex w-44 shrink-0 snap-start flex-col items-center rounded-xl border border-border px-3 pt-5 pb-3 text-center">
      <Link
        href={`/${user.username}`}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserAvatar src={user.avatarUrl} alt="" size={ring === 'none' ? 72 : 64} ring={ring} />
      </Link>
      <Link
        href={`/${user.username}`}
        className="mt-3 flex w-full min-w-0 items-center justify-center gap-1 text-sm font-semibold outline-none hover:opacity-70 focus-visible:underline"
      >
        <span className="truncate">{user.username}</span>
        {user.isVerified && <VerifiedBadge />}
      </Link>
      <span className="line-clamp-2 h-8 w-full text-xs leading-4 text-muted-foreground">
        {reason}
      </span>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'mt-3 h-8 w-full rounded-lg text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          following
            ? 'bg-secondary text-foreground hover:bg-foreground/10'
            : 'bg-brand text-brand-foreground hover:bg-brand-hover',
        )}
      >
        {status === 'PENDING'
          ? tProfile('requested')
          : status === 'ACCEPTED'
            ? tProfile('following')
            : tProfile('follow')}
      </button>
    </li>
  );
}

/** Popular posts from people I don't follow, loading on as the page scrolls */
export function SuggestedPosts({ hide }: { hide: ReadonlySet<string> }) {
  const t = useTranslations('feed');
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuggestedPosts(true);
  const { ref, inView } = useInView({ rootMargin: '800px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Photo posts only (reels live in Reels), never one already shown above
  const posts = uniqueByMedia(
    (data?.pages.flatMap((page) => page.items) ?? []).filter(
      (post) => post.type === 'POST' && !hide.has(post.id) && !hide.has(mediaKey(post)),
    ),
  );

  if (isPending) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="suggested-posts-title">
      <h2 id="suggested-posts-title" className="mb-4 font-semibold max-md:px-3">
        {t('suggestedPosts')}
      </h2>
      <div className="space-y-5">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <div ref={ref} />
      {isFetchingNextPage ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        !hasNextPage && (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            {t('endOfSuggested')}
          </p>
        )
      )}
    </section>
  );
}
