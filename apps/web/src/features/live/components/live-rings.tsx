'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { useFollowingLives } from '../queries';

// LIVE-3: people I follow who are live right now, first in the stories row: their photo in a
// live-colored ring with a small "LIVE" tag on it. A tap opens the live.
export function LiveRings() {
  const t = useTranslations('live');
  const { data: me } = useMe();
  const { data: lives } = useFollowingLives();
  const others = lives?.filter((live) => live.host.id !== me?.id) ?? [];

  return others.map(({ id, host }) => (
    <Link
      key={id}
      href={`/live/${host.username}`}
      draggable={false}
      aria-label={t('watch', { username: host.username })}
      className="group flex w-22.5 shrink-0 select-none flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span className="relative transition-transform duration-150 ease-out group-active:scale-95 motion-reduce:transition-none">
        <span className="block rounded-full bg-live p-0.75">
          <span className="block rounded-full bg-background p-0.75">
            <UserAvatar src={host.avatarUrl} alt="" size={62} />
          </span>
        </span>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md border-2 border-background bg-live px-1.5 text-[10px] leading-4 font-bold tracking-wide text-white">
          {t('badge')}
        </span>
      </span>
      <span className="mt-1 w-full truncate text-center text-xs">{host.username}</span>
    </Link>
  ));
}
