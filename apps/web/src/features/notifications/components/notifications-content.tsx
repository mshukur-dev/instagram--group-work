'use client';

import type { Notification } from '@instagram/shared';
import { ChevronRight, Heart, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { useFollowRequests, useMarkNotificationsRead, useNotifications } from '../queries';
import { FollowRequests } from './follow-requests';
import { type NotificationGroup, NotificationRow } from './notification-row';

type Section = 'today' | 'thisWeek' | 'thisMonth' | 'earlier';
const DAY = 86_400_000;

function sectionOf(date: string): Section {
  const created = new Date(date);
  if (created.toDateString() === new Date().toDateString()) return 'today';
  const age = Date.now() - created.getTime();
  if (age < 7 * DAY) return 'thisWeek';
  if (age < 30 * DAY) return 'thisMonth';
  return 'earlier';
}

// Likes of the same post, comment or story become one row with all the people in it
function likeTarget(n: Notification) {
  if (n.type === 'POST_LIKE') return `post:${n.post?.id}`;
  if (n.type === 'COMMENT_LIKE') return `comment:${n.comment?.id}`;
  if (n.type === 'STORY_LIKE') return `story:${n.storyId}`;
  return null;
}

function groupBySection(notifications: Notification[]) {
  const sections = new Map<Section, NotificationGroup[]>();
  for (const n of notifications) {
    // Requests have their own list at the top
    if (n.type === 'FOLLOW_REQUEST') continue;
    const section = sectionOf(n.createdAt);
    const groups = sections.get(section) ?? [];
    const target = likeTarget(n);
    const same = target && groups.find((g) => likeTarget(g.notification) === target);
    if (same) {
      if (!same.actors.some((a) => a.id === n.actor.id)) same.actors.push(n.actor);
    } else {
      groups.push({ key: n.id, notification: n, actors: [n.actor] });
    }
    sections.set(section, groups);
  }
  return [...sections];
}

function RequestsEntry({ count, onOpen }: { count: number; onOpen: () => void }) {
  const t = useTranslations('notifications');
  const { data } = useFollowRequests();
  const firstUser = data?.pages[0]?.items[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-6 py-3 text-left outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6 max-md:px-4"
    >
      <UserAvatar src={firstUser?.avatarUrl ?? null} alt="" size={44} />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold">{t('requestsTitle')}</span>
        <span className="block truncate text-muted-foreground">
          {firstUser
            ? t('requestsFrom', { username: firstUser.username, others: count - 1 })
            : t('requestsCount', { count })}
        </span>
      </span>
      <span className="size-2 shrink-0 rounded-full bg-brand" />
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

// NOTIF-1…4: what happened with my posts, comments, stories and followers, newest first
export function NotificationsContent({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  /** The desktop panel shows an X in the corner */
  onClose?: () => void;
}) {
  const t = useTranslations('notifications');
  const { data: me } = useMe();
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications();
  const { mutate: markRead } = useMarkNotificationsRead();
  const [showRequests, setShowRequests] = useState(false);
  const { ref, inView } = useInView({ rootMargin: '300px' });

  // Opening the list counts as reading it; new rows keep their highlight until next time
  useEffect(() => markRead(), [markRead]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (showRequests) {
    return <FollowRequests onBack={() => setShowRequests(false)} onNavigate={onNavigate} />;
  }

  const requestsCount = me?.pendingFollowRequestsCount ?? 0;
  const sections = groupBySection(data?.pages.flatMap((page) => page.items) ?? []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-6 pt-6 pb-4 max-md:px-4 max-md:pt-3">
        <h2 className="text-2xl font-semibold max-md:text-xl">{t('title')}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid size-9 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-6" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {requestsCount > 0 && (
          <RequestsEntry count={requestsCount} onOpen={() => setShowRequests(true)} />
        )}

        {isPending ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">{t('error')}</p>
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
            <span className="grid size-16 place-items-center rounded-full border-2 border-foreground">
              <Heart className="size-8" strokeWidth={1.5} />
            </span>
            <p className="font-semibold">{t('emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
          </div>
        ) : (
          sections.map(([section, groups]) => (
            <section key={section} className="border-t border-border py-2 first-of-type:border-t-0">
              <h3 className="px-6 pt-2 pb-1 font-semibold max-md:px-4">
                {t(`sections.${section}`)}
              </h3>
              <ul>
                {groups.map((group) => (
                  <NotificationRow key={group.key} group={group} onNavigate={onNavigate} />
                ))}
              </ul>
            </section>
          ))
        )}

        <div ref={ref} />
        {isFetchingNextPage && (
          <div className="grid place-items-center py-4 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
