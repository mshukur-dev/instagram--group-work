'use client';

import type { Hashtag, Location, UserPreview } from '@instagram/shared';
import { Hash, MapPin, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { storyRing } from '@/components/story-avatar';
import { UserAvatar } from '@/components/user-avatar';

export const rowClass =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6';

/** The round badge on the left of a hashtag or place row, the size of an avatar */
const badgeClass =
  'grid size-11 shrink-0 place-items-center rounded-full border border-border text-foreground';

export function UserRow({
  user,
  onSelect,
  onRemove,
}: {
  user: UserPreview;
  onSelect: (user: UserPreview) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations('search');
  return (
    <li className="relative">
      <Link href={`/${user.username}`} onClick={() => onSelect(user)} className={rowClass}>
        <UserAvatar src={user.avatarUrl} alt="" size={44} ring={storyRing(user)} />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">{user.username}</span>
          <span className="block truncate text-muted-foreground">{user.fullName}</span>
        </span>
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('remove', { username: user.username })}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      )}
    </li>
  );
}

export function HashtagRow({ hashtag }: { hashtag: Hashtag }) {
  const t = useTranslations('search');
  return (
    <li>
      <Link href={`/explore/tags/${encodeURIComponent(hashtag.name)}`} className={rowClass}>
        <span className={badgeClass}>
          <Hash className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">#{hashtag.name}</span>
          <span className="block truncate text-muted-foreground">
            {t('postsCount', { count: hashtag.postsCount })}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function PlaceRow({ place }: { place: Location }) {
  const t = useTranslations('search');
  return (
    <li>
      <Link href={`/explore/locations/${place.id}`} className={rowClass}>
        <span className={badgeClass}>
          <MapPin className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">{place.name}</span>
          <span className="block truncate text-muted-foreground">
            {place.address
              ? t('placeLine', { address: place.address, count: place.postsCount })
              : t('postsCount', { count: place.postsCount })}
          </span>
        </span>
      </Link>
    </li>
  );
}
