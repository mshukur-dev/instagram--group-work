'use client';

import type { AdminCounts } from '@instagram/shared';
import {
  Ban,
  Camera,
  Circle,
  Clapperboard,
  type LucideIcon,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAdminStats } from '../queries';

const metrics: { key: keyof AdminCounts; icon: LucideIcon }[] = [
  { key: 'users', icon: Users },
  { key: 'posts', icon: Camera },
  { key: 'reels', icon: Clapperboard },
  { key: 'stories', icon: Sparkles },
  { key: 'messages', icon: MessageCircle },
];

const card = 'rounded-2xl border border-border bg-card p-5';

// ADMIN-2: totals with today's and this week's growth, who is online, how many are banned
export function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const format = useFormatter();
  const { data: stats, isError, refetch } = useAdminStats();
  const n = (value: number) => format.number(value);

  if (isError) {
    return (
      <div className={cn(card, 'flex items-center justify-between text-sm')}>
        <span className="text-muted-foreground">{t('loadFailed')}</span>
        <button type="button" onClick={() => void refetch()} className="font-semibold text-brand">
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <div className={cn(card, 'flex items-center gap-4')}>
          <span className="relative flex size-11 items-center justify-center rounded-full bg-emerald-500/12">
            <Circle className="size-3 fill-emerald-500 text-emerald-500" />
            <span className="absolute size-3 animate-ping rounded-full bg-emerald-500/40" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{t('online')}</p>
            <p className="text-3xl leading-tight font-semibold tabular-nums">
              {stats ? n(stats.online) : '—'}
            </p>
          </div>
        </div>
        <Link
          href="/admin/users?filter=banned"
          className={cn(
            card,
            'flex items-center gap-4 outline-none transition-colors hover:bg-foreground/3 focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Ban className="size-5" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{t('banned')}</p>
            <p className="text-3xl leading-tight font-semibold tabular-nums">
              {stats ? n(stats.bannedUsers) : '—'}
            </p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2">
        {metrics.map(({ key, icon: Icon }) => (
          <div key={key} className={cn(card, 'flex flex-col gap-4')}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">{t(`metrics.${key}`)}</span>
              <Icon className="size-4.5" />
            </div>
            {stats ? (
              <p className="text-3xl leading-none font-semibold tabular-nums">
                {n(stats.total[key])}
              </p>
            ) : (
              <span className="h-7.5 w-16 animate-pulse rounded-md bg-foreground/6" />
            )}
            <dl className="space-y-1 border-t border-border pt-3 text-xs">
              <Growth label={t('today')} value={stats?.today[key]} />
              <Growth label={t('week')} value={stats?.last7Days[key]} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Growth({ label, value }: { label: string; value: number | undefined }) {
  const format = useFormatter();
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'font-semibold tabular-nums',
          value ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
      >
        {value === undefined ? '—' : `+${format.number(value)}`}
      </dd>
    </div>
  );
}
