'use client';

import type { AdminUser } from '@instagram/shared';
import { ExternalLink, Search, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import type { UsersFilter } from '../api';
import { useAdminUsers, useUnbanUser } from '../queries';
import { AdminCard, Pill } from './admin-shell';
import { ListNote, LoadMore, Segmented, SkeletonRows, useTimeAgo } from './admin-ui';
import { BanDialog } from './ban-dialog';

type Status = 'all' | 'active' | 'banned';
const bannedParam: Record<Status, boolean | undefined> = {
  all: undefined,
  active: false,
  banned: true,
};

const cell = 'px-4 py-3 align-middle';

// ADMIN-3 / ADMIN-4: search by username, name or email; sort by sign-up date; ban and unban.
// The status filter lives in the URL (?filter=banned), so the dashboard can link to it.
export function AdminUsers() {
  const t = useTranslations('admin.users');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status: Status =
    params.get('filter') === 'banned'
      ? 'banned'
      : params.get('filter') === 'active'
        ? 'active'
        : 'all';

  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<UsersFilter['sort']>('newest');

  // Search after a short pause in typing, not on every key
  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const setStatus = (next: Status) =>
    router.replace(next === 'all' ? pathname : `${pathname}?filter=${next}`, { scroll: false });

  const query = useAdminUsers({ q, sort, banned: bannedParam[status] });
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-10 min-w-0 flex-1 basis-72 items-center rounded-full bg-foreground/5 px-4 focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">{t('search')}</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('search')}
            maxLength={64}
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              aria-label={t('clear')}
              className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <Segmented
          label={t('statusLabel')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('status.all') },
            { value: 'active', label: t('status.active') },
            { value: 'banned', label: t('status.banned') },
          ]}
        />
        <Segmented
          label={t('sortLabel')}
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: t('sort.newest') },
            { value: 'oldest', label: t('sort.oldest') },
          ]}
        />
      </div>

      <AdminCard>
        {query.isPending ? (
          <SkeletonRows />
        ) : query.isError ? (
          <ListNote>{t('loadFailed')}</ListNote>
        ) : users.length === 0 ? (
          <ListNote>{q ? t('noResults', { q }) : t('empty')}</ListNote>
        ) : (
          // relative: keeps the sr-only header inside the scroll box, not the page
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-180 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className={cn(cell, 'font-medium')}>{t('columns.user')}</th>
                  <th className={cn(cell, 'font-medium')}>{t('columns.email')}</th>
                  <th className={cn(cell, 'font-medium')}>{t('columns.joined')}</th>
                  <th className={cn(cell, 'text-right font-medium')}>{t('columns.posts')}</th>
                  <th className={cn(cell, 'text-right font-medium max-xl:hidden')}>
                    {t('columns.followers')}
                  </th>
                  <th className={cn(cell, 'font-medium')}>{t('columns.status')}</th>
                  <th className={cell}>
                    <span className="sr-only">{t('columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  'divide-y divide-border transition-opacity',
                  query.isPlaceholderData && 'opacity-60',
                )}
              >
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
        />
      </AdminCard>
    </div>
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

  return (
    <tr className={cn('transition-colors hover:bg-foreground/2', banned && 'bg-destructive/3')}>
      <td className={cell}>
        <div className="flex items-center gap-3">
          <UserAvatar
            src={user.avatarUrl}
            alt={user.username}
            size={36}
            className={cn(banned && 'opacity-50 grayscale')}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{user.username}</span>
              {isAdmin && <Pill tone="strong">{t('admin')}</Pill>}
              {isMe && <Pill>{t('you')}</Pill>}
            </div>
            <p className="truncate text-muted-foreground">{user.fullName}</p>
          </div>
        </div>
      </td>
      <td className={cn(cell, 'max-w-56 truncate text-muted-foreground')}>{user.email}</td>
      <td className={cn(cell, 'whitespace-nowrap text-muted-foreground')}>
        {format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
      </td>
      <td className={cn(cell, 'text-right tabular-nums')}>{format.number(user.postsCount)}</td>
      <td className={cn(cell, 'text-right tabular-nums max-xl:hidden')}>
        {format.number(user.followersCount)}
      </td>
      <td className={cell}>
        {banned ? (
          <div className="max-w-52">
            <Pill tone="danger">{t('banned')}</Pill>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={user.banReason ?? ''}>
              {user.banReason}
            </p>
          </div>
        ) : user.isOnline ? (
          <Pill tone="online">
            <span className="size-1.5 rounded-full bg-current" />
            {t('online')}
          </Pill>
        ) : (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {user.lastSeenAt ? t('lastSeen', { time: timeAgo(user.lastSeenAt) }) : t('offline')}
          </span>
        )}
      </td>
      <td className={cn(cell, 'text-right')}>
        <div className="flex items-center justify-end gap-1.5">
          {/* A banned profile is hidden from everyone, admins included */}
          {!banned && (
            <Link
              href={`/${user.username}`}
              aria-label={t('openProfile', { username: user.username })}
              title={t('openProfile', { username: user.username })}
              className="rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="size-4" />
            </Link>
          )}
          {!isAdmin &&
            (banned ? (
              <button
                type="button"
                disabled={unban.isPending}
                onClick={() => setUnbanOpen(true)}
                className="h-8 rounded-lg bg-foreground/6 px-3 text-[13px] font-semibold outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {t('unban')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setBanOpen(true)}
                className="h-8 rounded-lg bg-destructive/10 px-3 text-[13px] font-semibold text-destructive outline-none transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('ban')}
              </button>
            ))}
        </div>
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
      </td>
    </tr>
  );
}
