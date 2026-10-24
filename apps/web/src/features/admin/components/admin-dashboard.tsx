'use client';

import type { AdminCounts, AdminUserRef } from '@instagram/shared';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { profileButton } from '@/features/profile/components/profile-button';
import { cn } from '@/lib/utils';
import { useAdminStats } from '../queries';
import { AdminTitle } from './admin-shell';
import { ListNote } from './admin-ui';

const metrics: (keyof AdminCounts)[] = ['users', 'posts', 'reels', 'stories', 'messages'];

const sectionTitle = 'mb-4 text-base font-bold max-md:px-4';

// ADMIN-2. The page reads like an Instagram profile: who is online sits where the stories
// tray would be, the totals follow the "5 posts · 5 followers" rhythm of the profile header.
export function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const tTabs = useTranslations('admin.tabs');
  const format = useFormatter();
  const { data: stats, isError, refetch } = useAdminStats();

  if (isError) {
    return (
      <>
        <AdminTitle>{tTabs('dashboard')}</AdminTitle>
        <ListNote>
          {t('loadFailed')}{' '}
          <button
            type="button"
            onClick={() => void refetch()}
            className="font-semibold text-brand hover:text-brand-hover"
          >
            {t('retry')}
          </button>
        </ListNote>
      </>
    );
  }

  return (
    <>
      <AdminTitle>{tTabs('dashboard')}</AdminTitle>

      <section className="pb-8">
        <h3 className={sectionTitle}>
          {t('online')}
          {stats && (
            <span className="ml-2 font-normal text-muted-foreground">
              {format.number(stats.online)}
            </span>
          )}
        </h3>
        {stats ? (
          stats.onlineUsers.length > 0 ? (
            <ActiveNow users={stats.onlineUsers} />
          ) : (
            <p className="text-sm text-muted-foreground max-md:px-4">{t('nobodyOnline')}</p>
          )
        ) : (
          <div className="flex gap-4 max-md:px-4" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="size-16 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border/60 py-8">
        <h3 className={sectionTitle}>{t('totals')}</h3>
        <dl className="grid grid-cols-5 gap-x-6 gap-y-8 max-md:grid-cols-2 max-md:px-4">
          {metrics.map((key) => (
            <div key={key}>
              <dt className="text-sm text-muted-foreground">{t(`metrics.${key}`)}</dt>
              <dd className="mt-1">
                {stats ? (
                  <>
                    <span className="block text-[28px] leading-tight font-semibold tabular-nums">
                      {format.number(stats.total[key])}
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground tabular-nums">
                      {t('growthToday', { count: format.number(stats.today[key]) })}
                      <br />
                      {t('growthWeek', { count: format.number(stats.last7Days[key]) })}
                    </span>
                  </>
                ) : (
                  <span className="block h-8.5 w-14 animate-pulse rounded bg-muted" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex items-center justify-between gap-4 border-t border-border/60 py-6 max-md:px-4">
        <div>
          <h3 className="text-base font-bold">{t('banned')}</h3>
          <p className="text-sm text-muted-foreground">
            {stats ? t('bannedCount', { count: stats.bannedUsers }) : '…'}
          </p>
        </div>
        <Link href="/admin/users?filter=banned" className={profileButton('secondary')}>
          {t('viewBanned')}
        </Link>
      </section>
    </>
  );
}

// Width of the fade at an edge, in px
const FADE = 40;

const arrow =
  'absolute top-9 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-900 shadow-md outline-none transition-opacity duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring max-md:hidden';

/**
 * The stories-tray row, with Direct's green "online" dot instead of a story ring. Like the tray
 * it is a swiper: dragged or swiped with momentum, the edges fade instead of cutting avatars,
 * and on a computer white arrows at the sides move it by a page.
 */
function ActiveNow({ users }: { users: AdminUserRef[] }) {
  const t = useTranslations('post');
  const [viewport, embla] = useEmblaCarousel({
    dragFree: true,
    containScroll: 'trimSnaps',
    align: 'start',
    slidesToScroll: 'auto',
    duration: 28,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Fade and arrows follow the scroll position
  useEffect(() => {
    const root = embla?.rootNode();
    const track = embla?.containerNode();
    if (!embla || !root || !track) return;

    const update = () => {
      const overflow = Math.max(0, track.scrollWidth - root.clientWidth);
      const scrolled = embla.scrollProgress() * overflow;
      root.style.setProperty(
        '--fade-start',
        `${Math.max(0, Math.min(FADE, scrolled)).toFixed(1)}px`,
      );
      root.style.setProperty(
        '--fade-end',
        `${Math.max(0, Math.min(FADE, overflow - scrolled)).toFixed(1)}px`,
      );
      setCanPrev(scrolled > 1);
      setCanNext(overflow - scrolled > 1);
    };

    update();
    embla.on('scroll', update).on('reInit', update).on('resize', update).on('settle', update);
    return () => {
      embla.off('scroll', update).off('reInit', update).off('resize', update).off('settle', update);
    };
  }, [embla, users.length]);

  // Trackpad / shift+wheel moves the row too (it is moved by transforms, not native scroll)
  useEffect(() => {
    const node = embla?.rootNode();
    if (!embla || !node) return;
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) < 8 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (locked) return;
      locked = true;
      window.setTimeout(() => (locked = false), 220);
      if (event.deltaX > 0) embla.scrollNext();
      else embla.scrollPrev();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [embla]);

  return (
    <div className="relative max-md:px-3">
      <div ref={viewport} className="edge-fade overflow-hidden">
        <ul className="flex cursor-grab touch-pan-y gap-1 active:cursor-grabbing">
          {users.map((user) => (
            <li key={user.id} className="shrink-0">
              <Link
                href={`/${user.username}`}
                draggable={false}
                className="group flex w-20 select-none flex-col items-center gap-1.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="relative transition-transform duration-150 ease-out group-active:scale-95 motion-reduce:transition-none">
                  <UserAvatar src={user.avatarUrl} alt={user.username} size={64} />
                  <span className="absolute right-0.5 bottom-0.5 size-3.5 rounded-full bg-emerald-500 ring-[3px] ring-background" />
                </span>
                <span className="w-full truncate text-center text-xs">{user.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => embla?.scrollPrev()}
        aria-label={t('previous')}
        tabIndex={canPrev ? 0 : -1}
        className={cn(arrow, 'left-2', !canPrev && 'pointer-events-none opacity-0')}
      >
        <ChevronLeft className="size-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => embla?.scrollNext()}
        aria-label={t('next')}
        tabIndex={canNext ? 0 : -1}
        className={cn(arrow, 'right-2', !canNext && 'pointer-events-none opacity-0')}
      >
        <ChevronRight className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
