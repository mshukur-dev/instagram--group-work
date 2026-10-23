'use client';

import type { AdminAction, AdminActionType } from '@instagram/shared';
import { Ban, type LucideIcon, MessageCircleX, ShieldCheck, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useAdminActions } from '../queries';
import { AdminCard } from './admin-shell';
import { ListNote, LoadMore, SkeletonRows, useTimeAgo } from './admin-ui';

const icons: Record<AdminActionType, { icon: LucideIcon; className: string }> = {
  BAN_USER: { icon: Ban, className: 'bg-destructive/10 text-destructive' },
  UNBAN_USER: {
    icon: ShieldCheck,
    className: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  },
  DELETE_POST: { icon: Trash2, className: 'bg-foreground/6 text-foreground' },
  DELETE_COMMENT: { icon: MessageCircleX, className: 'bg-foreground/6 text-foreground' },
};

// ADMIN-6: who did what to whom, newest first
export function AdminLog() {
  const t = useTranslations('admin.log');
  const query = useAdminActions();
  const actions = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <AdminCard>
      {query.isPending ? (
        <SkeletonRows />
      ) : query.isError ? (
        <ListNote>{t('loadFailed')}</ListNote>
      ) : actions.length === 0 ? (
        <ListNote>{t('empty')}</ListNote>
      ) : (
        <ol className="divide-y divide-border">
          {actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </ol>
      )}
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </AdminCard>
  );
}

function ActionRow({ action }: { action: AdminAction }) {
  const t = useTranslations('admin.log');
  const format = useFormatter();
  const timeAgo = useTimeAgo();
  const { icon: Icon, className } = icons[action.type];
  const target = action.targetUser?.username ?? t('deletedUser');
  const isReel = action.details?.postType === 'REEL';
  const quote =
    action.type === 'BAN_USER'
      ? action.details?.reason
      : action.type === 'DELETE_POST'
        ? action.details?.caption
        : action.type === 'DELETE_COMMENT'
          ? action.details?.text
          : null;
  const kind = action.type === 'DELETE_POST' && isReel ? 'DELETE_REEL' : action.type;

  return (
    <li className="flex items-start gap-3.5 px-5 py-3.5">
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
          className,
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="wrap-break-word">
          {t.rich(`actions.${kind}`, {
            admin: action.admin.username,
            target,
            b: (chunks) => <span className="font-semibold">{chunks}</span>,
          })}
        </p>
        {quote && (
          <p className="mt-1 line-clamp-2 border-l-2 border-border pl-2.5 text-muted-foreground wrap-break-word">
            {quote}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <time
          dateTime={action.createdAt}
          title={format.dateTime(new Date(action.createdAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        >
          {timeAgo(action.createdAt)}
        </time>
        <UserAvatar src={action.admin.avatarUrl} alt={action.admin.username} size={20} />
      </div>
    </li>
  );
}
