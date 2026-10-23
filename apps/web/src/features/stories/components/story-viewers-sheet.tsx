'use client';

import type { Story } from '@instagram/shared';
import { ChevronUp, Heart, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { UserAvatar } from '@/components/user-avatar';
import { useStoryViewers } from '../queries';

type Props = {
  story: Story;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// STORY-5: "Seen by N" at the bottom of my own story; opens a panel with the viewers.
// The story stays paused while the panel is open.
export function StoryViewersSheet({ story, open, onOpenChange }: Props) {
  const t = useTranslations('stories');
  const reduceMotion = useReducedMotion();
  const count = story.viewsCount ?? 0;

  return (
    <>
      {/* A soft dark floor so the white text reads on a light story too */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/55 via-black/20 to-transparent"
      />
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="absolute bottom-4 left-4 flex items-center gap-1 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_2px_12px_rgb(0_0_0/0.25)] outline-none backdrop-blur-xl transition-colors hover:bg-black/50 focus-visible:ring-2 focus-visible:ring-white"
      >
        <ChevronUp className="size-4" />
        {t('seenBy', { count })}
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label={t('viewers')}
            initial={reduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            onKeyDown={(event) => event.key === 'Escape' && onOpenChange(false)}
            className="absolute inset-x-0 bottom-0 z-10 flex h-3/5 flex-col rounded-t-2xl bg-neutral-900 text-white shadow-2xl"
          >
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 pr-2 pl-4">
              <h2 className="text-[15px] font-semibold">
                {count > 0 ? t('seenBy', { count }) : t('viewers')}
              </h2>
              <button
                type="button"
                autoFocus
                onClick={() => onOpenChange(false)}
                aria-label={t('close')}
                className="grid size-9 place-items-center rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="size-5" />
              </button>
            </header>
            <ViewersList storyId={story.id} />
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function ViewersList({ storyId }: { storyId: string }) {
  const t = useTranslations('stories');
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useStoryViewers(storyId, true);
  const { ref, inView } = useInView({ rootMargin: '200px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-5 animate-spin text-white/60" />
      </div>
    );
  }

  const viewers = isError ? [] : data.pages.flatMap((page) => page.items);
  if (viewers.length === 0) {
    return (
      <p className="grid flex-1 place-items-center px-6 text-center text-sm text-white/60">
        {isError ? t('viewersError') : t('noViewers')}
      </p>
    );
  }

  return (
    <ul data-scrollable className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
      {viewers.map((viewer) => (
        <li key={viewer.id} className="flex items-center gap-3 py-2">
          <Link href={`/${viewer.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar src={viewer.avatarUrl} alt={viewer.username} size={40} />
            <span className="min-w-0 text-sm">
              <span className="block truncate font-semibold">{viewer.username}</span>
              <span className="block truncate text-white/60">{viewer.fullName}</span>
            </span>
          </Link>
          {viewer.liked && (
            <Heart
              className="size-5 shrink-0 fill-like text-like"
              aria-label={t('liked')}
            />
          )}
        </li>
      ))}
      <li ref={ref} className="flex justify-center">
        {isFetchingNextPage && <Loader2 className="my-3 size-5 animate-spin text-white/60" />}
      </li>
    </ul>
  );
}
