'use client';

import type { AdminUser } from '@instagram/shared';
import { Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { profileButton } from '@/features/profile/components/profile-button';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import type { UsersFilter } from '../api';
import { useAdminUsers, useUnbanUser } from '../queries';
import { AdminTitle } from './admin-shell';
import {
  Chips,
  EmptyState,
  ListNote,
  LoadMore,
  RowsSkeleton,
  SearchField,
  useDebounced,
  useTimeAgo,
} from './admin-ui';
import { BanDialog } from './ban-dialog';

type Status = 'all' | 'active' | 'banned';
const bannedParam: Record<Status, boolean | undefined> = {
  all: undefined,
  active: false,
  banned: true,
};

// ADMIN-3 / ADMIN-4: search by username, name or email; sort by sign-up date; ban and unban.
// Rows look like the followers list. The status filter lives in the URL (?filter=banned),
// so the dashboard can link straight to the banned accounts.
export function AdminUsers() {
  const t = useTranslations('admin.users');
  const tTabs = useTranslations('admin.tabs');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = params.get('filter');
  const status: Status = filter === 'banned' || filter === 'active' ? filter : 'all';

  const [input, setInput] = useState('');
  const q = useDebounced(input);
  const [sort, setSort] = useState<UsersFilter['sort']>('newest');

  const setStatus = (next: Status) =>
    router.replace(next === 'all' ? pathname : `${pathname}?filter=${next}`, { scroll: false });

  const query = useAdminUsers({ q, sort, banned: bannedParam[status] });
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <AdminTitle>{tTabs('users')}</AdminTitle>

      <div className="mb-4 space-y-3 max-md:px-4">
        <SearchField value={input} onChange={setInput} placeholder={t('search')} />
        <div className="flex items-center justify-between gap-3 overflow-x-auto [scrollbar-width:none]">
          <Chips
            label={t('statusLabel')}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('status.all') },
              { value: 'active', label: t('status.active') },
              { value: 'banned', label: t('status.banned') },
            ]}
          />
          <Chips
            label={t('sortLabel')}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'newest', label: t('sort.newest') },
              { value: 'oldest', label: t('sort.oldest') },
            ]}
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="max-md:px-4">
          <RowsSkeleton />
        </div>
      ) : query.isError ? (
        <ListNote>{t('loadFailed')}</ListNote>
      ) : users.length === 0 ? (
        q ? (
          <ListNote>{t('noResults', { q })}</ListNote>
        ) : (
          <EmptyState icon={Users} title={t('empty')} />
        )
      ) : (
        <ul
          className={cn('transition-opacity max-md:px-4', query.isPlaceholderData && 'opacity-60')}
        >
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      )}
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const t = useTranslations('admin.users');
  const format = useFormatter();
  const timeAgo = useTimeAgo();
  const { data: me } = useMe();
  const unban = useUnbanUser();
  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const banned = user.bannedAt !== null;
  const isAdmin = user.role === 'ADMIN';
  const isMe = me?.id === user.id;

  const avatar = (
    <UserAvatar
      src={user.avatarUrl}
      alt={user.username}
      size={44}
      className={cn(banned && 'opacity-60 grayscale')}
    />
  );
  // A banned profile is hidden from everyone, admins included: no link to it
  const profileHref = banned ? null : `/${user.username}`;

  return (
    <li className="flex items-center gap-3 py-2.5">
      {profileHref ? (
        <Link href={profileHref} className="shrink-0 rounded-full">
          {avatar}
        </Link>
      ) : (
        <span className="shrink-0">{avatar}</span>
      )}

      <div className="min-w-0 flex-1 text-sm">
        <p className="flex items-center gap-1.5">
          {profileHref ? (
            <Link href={profileHref} className="truncate font-semibold hover:opacity-60">
              {user.username}
            </Link>
          ) : (
            <span className="truncate font-semibold">{user.username}</span>
          )}
          {(isAdmin || isMe) && (
            <span className="shrink-0 text-muted-foreground">· {isMe ? t('you') : t('admin')}</span>
          )}
        </p>
        <p className="truncate text-muted-foreground">
          {user.fullName} · {user.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {banned ? (
            <span className="text-destructive" title={user.banReason ?? undefined}>
              {t('bannedBecause', { reason: user.banReason ?? '' })}
            </span>
          ) : (
            <>
              {t('meta', {
                joined: format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' }),
                posts: user.postsCount,
                followers: user.followersCount,
              })}
              {' · '}
              {user.isOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400">{t('online')}</span>
              ) : user.lastSeenAt ? (
                t('lastSeen', { time: timeAgo(user.lastSeenAt) })
              ) : (
                t('offline')
              )}
            </>
          )}
        </p>
      </div>

      {!isAdmin &&
        (banned ? (
          <button
            type="button"
            disabled={unban.isPending}
            onClick={() => setUnbanOpen(true)}
            className={profileButton('primary')}
          >
            {t('unban')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setBanOpen(true)}
            className={profileButton('secondary')}
          >
            {t('ban')}
          </button>
        ))}

      {banOpen && <BanDialog user={user} open={banOpen} onOpenChange={setBanOpen} />}
      <ConfirmDialog
        open={unbanOpen}
        onOpenChange={setUnbanOpen}
        title={t('unbanTitle', { username: user.username })}
        description={t('unbanBody')}
        picture={<UserAvatar src={user.avatarUrl} alt={user.username} size={64} />}
        confirmLabel={t('unban')}
        cancelLabel={t('cancel')}
        onConfirm={() => unban.mutate(user.id)}
      />
    </li>
  );
}
