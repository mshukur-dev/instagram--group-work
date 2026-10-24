'use client';

import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';

/** Sent by Home in the menus when it is tapped on the home page itself */
export const HOME_REFRESH_EVENT = 'home:refresh';

export function requestHomeRefresh() {
  window.dispatchEvent(new Event(HOME_REFRESH_EVENT));
}

// How far to pull (after the drag is halved for a rubbery feel) before letting go refreshes
const TRIGGER = 64;
const MAX_PULL = 110;

/**
 * The home feed with a way to get fresh posts, like Instagram: on a phone, pull down from the
 * top; anywhere, tap Home (sidebar, bottom bar or the logo) while already on it. Both scroll up,
 * show a spinner and load the feed, stories and suggestions again.
 */
export function HomeFeed({ children }: { children: React.ReactNode }) {
  const t = useTranslations('feed');
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    try {
      // Reset, not just refetch: the feed starts again from its first page
      await Promise.all([
        queryClient.resetQueries({ queryKey: queryKeys.feed() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storiesFeed() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.suggestions() }),
      ]);
    } finally {
      // A refresh that is too quick to see doesn't feel like one
      setTimeout(() => setRefreshing(false), 400);
    }
  }, [queryClient, reduceMotion, refreshing]);

  useEffect(() => {
    const onRefresh = () => void refresh();
    window.addEventListener(HOME_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(HOME_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  // Pull to refresh (touch only): starts when the page is at its very top
  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      start.current = window.scrollY <= 0 ? (event.touches[0]?.clientY ?? null) : null;
    };
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      const dy = (event.touches[0]?.clientY ?? 0) - start.current;
      const next = window.scrollY <= 0 && dy > 0 ? Math.min(dy / 2, MAX_PULL) : 0;
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = () => {
      if (start.current !== null && pullRef.current >= TRIGGER) void refresh();
      start.current = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [refresh]);

  const height = refreshing ? 52 : pull;
  const ready = pull >= TRIGGER;

  return (
    <div>
      <motion.div
        aria-live="polite"
        initial={false}
        animate={{ height }}
        transition={pull > 0 ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
        className="flex items-center justify-center overflow-hidden"
      >
        {(refreshing || pull > 0) && (
          <span
            role={refreshing ? 'status' : undefined}
            aria-label={refreshing ? t('refreshing') : undefined}
            className="grid size-8 place-items-center"
            style={{ opacity: refreshing ? 1 : Math.min(1, pull / TRIGGER) }}
          >
            <Spinner spinning={refreshing} turn={refreshing ? 0 : pull * 4} ready={ready} />
          </span>
        )}
      </motion.div>
      {children}
    </div>
  );
}

/** Instagram's spinner: twelve short spokes; while pulling they turn with the finger */
function Spinner({ spinning, turn, ready }: { spinning: boolean; turn: number; ready: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={
        spinning ? 'size-7 animate-spin text-muted-foreground' : 'size-7 text-muted-foreground'
      }
      style={
        spinning
          ? { animationDuration: '0.9s' }
          : {
              transform: `rotate(${turn}deg) scale(${ready ? 1.1 : 1})`,
              transition: 'transform 120ms',
            }
      }
    >
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x="11"
          y="2.5"
          width="2"
          height="5.5"
          rx="1"
          fill="currentColor"
          opacity={0.25 + (i / 12) * 0.75}
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
    </svg>
  );
}
