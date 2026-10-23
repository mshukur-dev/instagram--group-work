'use client';

import type { AdminAction } from '@instagram/shared';
import { History } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useAdminActions } from '../queries';
import { AdminTitle } from './admin-shell';
import {
  EmptyState,
  ListNote,
  LoadMore,
  RowsSkeleton,
  SearchField,
  useDebounced,
  useTimeAgo,
} from './admin-ui';

// ADMIN-6: who did what to whom, newest first. Rows read like notifications:
// the admin's avatar, one sentence with the time at its end, the account on the right.
export function AdminLog() {
  const t = useTranslations('admin.log');
  const tTabs = useTranslations('admin.tabs');
  const [input, setInput] = useState('');
  const q = useDebounced(input);
  const query = useAdminActions(q);
  const actions = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <AdminTitle>{tTabs('log')}</AdminTitle>
      <SearchField
        value={input}
        onChange={setInput}
        placeholder={t('search')}
        className="mb-4 max-md:mx-4"
      />

      {query.isPending ? (
        <div className="max-md:px-4">
          <RowsSkeleton />
        </div>
      ) : query.isError ? (
        <ListNote>{t('loadFailed')}</ListNote>
      ) : actions.length === 0 ? (
        q ? (
          <ListNote>{t('noResults', { q })}</ListNote>
        ) : (
          <EmptyState icon={History} title={t('empty')} text={t('emptyText')} />
        )
      ) : (
        <ol
          className={cn('transition-opacity max-md:px-4', query.isPlaceholderData && 'opacity-60')}
        >
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
    </>
  );
}

function ActionRow({ action }: { action: AdminAction }) {
  const t = useTranslations('admin.log');
  const format = useFormatter();
  const timeAgo = useTimeAgo();
  const target = action.targetUser?.username ?? t('deletedUser');
  const quote =
    action.type === 'BAN_USER'
      ? action.details?.reason
      : action.type === 'DELETE_POST'
        ? action.details?.caption
        : action.type === 'DELETE_COMMENT'
          ? action.details?.text
          : null;
  const kind =
    action.type === 'DELETE_POST' && action.details?.postType === 'REEL'
      ? 'DELETE_REEL'
      : action.type;

  return (
    <li className="flex items-center gap-3 py-2.5">
      <UserAvatar
        src={action.admin.avatarUrl}
        alt={action.admin.username}
        size={44}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="wrap-break-word">
          {t.rich(`actions.${kind}`, {
            admin: action.admin.username,
            target,
            b: (chunks) => <span className="font-semibold">{chunks}</span>,
          })}{' '}
          <time
            dateTime={action.createdAt}
            title={format.dateTime(new Date(action.createdAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            className="text-muted-foreground"
          >
            {timeAgo(action.createdAt)}
          </time>
        </p>
        {quote && (
          <p
            className={cn(
              'mt-0.5 truncate',
              action.type === 'BAN_USER' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {action.type === 'BAN_USER' ? t('reason', { reason: quote }) : `“${quote}”`}
          </p>
        )}
      </div>
      {action.targetUser && (
        <UserAvatar
          src={action.targetUser.avatarUrl}
          alt={action.targetUser.username}
          size={44}
          className="shrink-0"
        />
      )}
    </li>
  );
}
