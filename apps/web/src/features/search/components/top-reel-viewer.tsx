'use client';

import { X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { SearchReelsFeed, TopReelsFeed } from '@/features/reels/components/reels-feed';

// A Top video opened right on the search page: the Reels player over the Top grid (the sidebar
// stays), scrolling through Top videos only. The X or Escape brings the grid back where it was.
export function TopReelViewer({
  startId,
  onClose,
  searchQuery,
}: {
  startId: string;
  onClose: () => void;
  /** Opened from search results: scroll through the reels found instead of Top */
  searchQuery?: string;
}) {
  const t = useTranslations('search');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    // The page under the viewer doesn't scroll while it is open
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t('topViewer')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      // Beside the sidebar on a computer (the sidebar stays, and opens over it), the whole
      // screen on a phone
      className="fixed inset-y-0 right-0 left-31 z-10 bg-background max-md:left-0 max-md:z-40"
    >
      {searchQuery ? (
        <SearchReelsFeed q={searchQuery} startId={startId} fullScreen />
      ) : (
        <TopReelsFeed startId={startId} fullScreen />
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-foreground/6 outline-none transition-colors hover:bg-foreground/12 focus-visible:ring-2 focus-visible:ring-ring max-md:bg-black/50 max-md:text-white"
      >
        <X className="size-6" />
      </button>
    </motion.div>
  );
}
