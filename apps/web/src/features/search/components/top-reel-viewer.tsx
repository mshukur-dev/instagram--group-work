'use client';

import { X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { TopReelsFeed } from '@/features/reels/components/reels-feed';

// A Top video opened right on the search page: the Reels player over the Top grid, scrolling
// through Top videos only. The X or Escape brings the grid back where it was.
export function TopReelViewer({ startId, onClose }: { startId: string; onClose: () => void }) {
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
      className="fixed inset-0 z-40 bg-background"
    >
      <TopReelsFeed startId={startId} fullScreen />
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
