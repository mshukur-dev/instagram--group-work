'use client';

import type { SuggestedUser, ViewerFollowStatus } from '@instagram/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { storyRing } from '@/components/story-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useFollowUser, useSuggestions } from '../queries';

// The home page's right column: people to follow with the reason under each name
// ("Followed by maria + 2 more"). It stays put while the feed scrolls.
export function SuggestionsRail({ className }: { className?: string }) {
  const t = useTranslations('feed');
  const { data: suggestions, isPending } = useSuggestions();

  return (
    <aside className={cn('w-80 shrink-0', className)}>
      {(isPending || (suggestions?.length ?? 0) > 0) && (
        <section aria-labelledby="suggested-title">
          <h2
            id="suggested-title"
            className="mb-2 px-1 text-sm font-semibold text-muted-foreground"
          >
            {t('suggestedForYou')}
          </h2>
          <ul className="space-y-1">
            {isPending
              ? Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 px-1 py-1.5">
                    <span className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
                    <span className="flex-1 space-y-1.5">
                      <span className="block h-3 w-28 animate-pulse rounded bg-muted" />
                      <span className="block h-3 w-40 animate-pulse rounded bg-muted" />
                    </span>
                  </li>
                ))
              : suggestions?.map((user) => <SuggestionRow key={user.id} user={user} />)}
          </ul>
        </section>
      )}
    </aside>
  );
}

/** 44px whatever the ring: a story ring adds 4px a side, so the photo shrinks inside it */
function RingAvatar({ user }: { user: Parameters<typeof storyRing>[0] }) {
  const ring = storyRing(user);
  return <UserAvatar src={user.avatarUrl} alt="" size={ring === 'none' ? 44 : 36} ring={ring} />;
}

function SuggestionRow({ user }: { user: SuggestedUser }) {
  const t = useTranslations('feed');
  const tProfile = useTranslations('profile');
  const reduceMotion = useReducedMotion();
  const follow = useFollowUser();
  // Answers at once; the server's answer (Following / Requested) replaces the guess
  // Suggestions are only people I don't follow yet
  const [status, setStatus] = useState<ViewerFollowStatus>('NONE');
  const following = status !== 'NONE';

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
    <li className="flex items-center gap-3 px-1 py-1.5">
      <Link
        href={`/${user.username}`}
        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RingAvatar user={user} />
      </Link>
      <span className="min-w-0 flex-1 text-sm">
        <Link
          href={`/${user.username}`}
          className="block truncate font-semibold outline-none hover:opacity-70 focus-visible:underline"
        >
          {user.username}
        </Link>
        <span className="block truncate text-xs text-muted-foreground" title={reason}>
          {reason}
        </span>
      </span>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'relative shrink-0 rounded-md px-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          following
            ? 'text-foreground hover:text-muted-foreground'
            : 'text-brand hover:text-brand-hover',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="block"
          >
            {status === 'PENDING'
              ? tProfile('requested')
              : status === 'ACCEPTED'
                ? tProfile('following')
                : tProfile('follow')}
          </motion.span>
        </AnimatePresence>
      </button>
    </li>
  );
}
