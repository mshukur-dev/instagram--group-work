'use client';

import type { AdminCounts, AdminUserRef } from '@instagram/shared';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { profileButton } from '@/features/profile/components/profile-button';
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

/** The stories-tray row, with Direct's green "online" dot instead of a story ring */
function ActiveNow({ users }: { users: AdminUserRef[] }) {
  return (
    <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 max-md:px-3">
      {users.map((user) => (
        <li key={user.id} className="shrink-0">
          <Link
            href={`/${user.username}`}
            className="flex w-20 flex-col items-center gap-1.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative">
              <UserAvatar src={user.avatarUrl} alt={user.username} size={64} />
              <span className="absolute right-0.5 bottom-0.5 size-3.5 rounded-full bg-emerald-500 ring-[3px] ring-background" />
            </span>
            <span className="w-full truncate text-center text-xs">{user.username}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
