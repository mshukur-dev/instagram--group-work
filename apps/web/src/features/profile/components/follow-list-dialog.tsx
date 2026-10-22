'use client';

import type { UserListItem, ViewerFollowStatus } from '@instagram/shared';
import { Loader2, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import type { FollowListKind } from '../api';
import { useFollowList, useFollowUser, useRemoveFollower } from '../queries';
import { FollowAction } from './follow-button';
import { ConfirmDialog, ProfileDialog } from './profile-dialog';
import { profileButton } from './profile-button';

type Props = {
  username: string;
  kind: FollowListKind;
  /** My own profile: followers get a Remove button (FOLLOW-3) */
  isMine: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// PROFILE-5: followers or following in a modal, with search and infinite scroll
export function FollowListDialog({ username, kind, isMine, open, onOpenChange }: Props) {
  const t = useTranslations('profile');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // The server is asked only after typing pauses
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const close = () => onOpenChange(false);

  return (
    <ProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`lists.${kind}`)}
      className="flex max-h-[min(80dvh,560px)] max-w-[400px] flex-col"
    >
      <header className="grid h-11 shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-border/50">
        <span />
        <h2 aria-hidden="true" className="text-center text-[15px] font-semibold">
          {t(`lists.${kind}`)}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={t('close')}
          className="grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <X className="size-5" />
        </button>
      </header>

      <label className="mx-4 mt-3 mb-1 flex h-9 shrink-0 items-center gap-2 rounded-lg bg-secondary px-3 text-muted-foreground focus-within:text-foreground">
        <Search className="size-4 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('lists.search')}
          aria-label={t('lists.search')}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      <UserList
        username={username}
        kind={kind}
        q={debounced}
        canRemove={isMine && kind === 'followers'}
        onNavigate={close}
      />
    </ProfileDialog>
  );
}

function UserList({
  username,
  kind,
  q,
  canRemove,
  onNavigate,
}: {
  username: string;
  kind: FollowListKind;
  q: string;
  canRemove: boolean;
  onNavigate: () => void;
}) {
  const t = useTranslations('profile');
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFollowList(username, kind, q);
  const { ref, inView } = useInView({ rootMargin: '200px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const message = (text: string) => (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">{text}</p>
  );

  if (isPending) {
    return (
      <div className="space-y-1 px-4 py-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 py-2">
            <div className="size-11 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (isError) return message(t('lists.error'));

  const users = data.pages.flatMap((page) => page.items);
  if (users.length === 0) {
    return message(q ? t('lists.noResults') : t(`lists.empty.${kind}`));
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
      {users.map((user) => (
        <UserRow key={user.id} user={user} canRemove={canRemove} onNavigate={onNavigate} />
      ))}
      <li ref={ref} className="flex justify-center">
        {isFetchingNextPage && (
          <Loader2 className="my-3 size-5 animate-spin text-muted-foreground" />
        )}
      </li>
    </ul>
  );
}

function UserRow({
  user,
  canRemove,
  onNavigate,
}: {
  user: UserListItem;
  canRemove: boolean;
  onNavigate: () => void;
}) {
  const t = useTranslations('profile');
  const follow = useFollowUser();
  const remove = useRemoveFollower();
  // The row answers at once; the server result replaces the guess when the list refetches
  const [status, setStatus] = useState<ViewerFollowStatus | null>(null);
  const [removed, setRemoved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const current = status ?? user.followStatus;

  if (removed) return null;

  const onChange = (next: boolean) => {
    const previous = current;
    // Most accounts are public; a private one corrects itself to Requested on the answer
    setStatus(next ? 'ACCEPTED' : 'NONE');
    follow.mutate(
      { username: user.username, follow: next },
      {
        onSuccess: (saved) => setStatus(saved),
        onError: () => setStatus(previous),
      },
    );
  };

  const ring = user.hasUnseenStory ? 'unseen' : user.hasActiveStory ? 'seen' : 'none';

  return (
    <li className="flex items-center gap-3 py-2">
      <Link href={`/${user.username}`} onClick={onNavigate} className="shrink-0">
        <UserAvatar src={user.avatarUrl} alt={user.username} size={44} ring={ring} />
      </Link>
      <Link href={`/${user.username}`} onClick={onNavigate} className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold">{user.username}</p>
        <p className="truncate text-muted-foreground">{user.fullName}</p>
      </Link>

      {canRemove ? (
        <>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => setConfirmRemove(true)}
            className={profileButton('secondary')}
          >
            {t('remove')}
          </button>
          <ConfirmDialog
            open={confirmRemove}
            onOpenChange={setConfirmRemove}
            picture={<UserAvatar src={user.avatarUrl} alt={user.username} size={90} />}
            title={t('removeFollowerTitle')}
            description={t('removeFollowerBody', { username: user.username })}
            confirmLabel={t('remove')}
            cancelLabel={t('cancel')}
            onConfirm={() => remove.mutate(user.username, { onSuccess: () => setRemoved(true) })}
          />
        </>
      ) : (
        !user.isMe && (
          <FollowAction
            username={user.username}
            avatarUrl={user.avatarUrl}
            status={current}
            onChange={onChange}
            className={cn(current === 'NONE' && 'min-w-[88px]')}
          />
        )
      )}
    </li>
  );
}
