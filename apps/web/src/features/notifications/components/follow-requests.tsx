'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { profileButton } from '@/features/profile/components/profile-button';
import { useAnswerFollowRequest, useFollowRequests } from '../queries';

// FOLLOW-2: people who asked to follow my private account; Confirm or Delete each one
export function FollowRequests({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: () => void;
}) {
  const t = useTranslations('notifications');
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useFollowRequests();
  const answer = useAnswerFollowRequest();
  const users = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-6 pb-4 max-md:pt-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="grid size-9 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-6" />
        </button>
        <h2 className="text-xl font-semibold">{t('requestsTitle')}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {isPending ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {t('requestsEmpty')}
          </p>
        ) : (
          <ul>
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-6 py-2 max-md:px-4">
                <Link href={`/${user.username}`} onClick={onNavigate} className="shrink-0">
                  <UserAvatar src={user.avatarUrl} alt={user.username} size={44} />
                </Link>
                <Link
                  href={`/${user.username}`}
                  onClick={onNavigate}
                  className="min-w-0 flex-1 text-sm"
                >
                  <span className="block truncate font-semibold">{user.username}</span>
                  <span className="block truncate text-muted-foreground">{user.fullName}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => answer.mutate({ userId: user.id, accept: true })}
                  className={profileButton('primary')}
                >
                  {t('confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => answer.mutate({ userId: user.id, accept: false })}
                  className={profileButton('secondary')}
                >
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {hasNextPage && (
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
            className="mx-auto mt-2 block text-sm font-semibold text-brand hover:text-brand-hover"
          >
            {t('showMore')}
          </button>
        )}
      </div>
    </div>
  );
}
