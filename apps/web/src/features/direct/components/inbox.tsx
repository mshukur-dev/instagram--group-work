'use client';

import { ClientEvent, type ConversationPreview } from '@instagram/shared';
import { SquarePen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useMe } from '@/features/profile/queries';
import { getSocket } from '@/lib/socket';
import { shortTimeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useConversations } from '../queries';
import { useRealtimeStore, useTypingIn } from '../realtime-store';
import { StoryHotspot } from '@/components/story-avatar';
import { ConversationAvatar } from './conversation-avatar';
import { NewMessageDialog } from './new-message-dialog';

// DM-6: who is online among the people I talk to. Asked once for the list (and again after a
// reconnect); after that the server pushes every change.
function usePresenceSubscription(userIds: string[]) {
  const key = userIds.join(',');
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !key) return;
    const ids = key.split(',');
    const subscribe = () =>
      socket.emit(ClientEvent.PRESENCE_SUBSCRIBE, { userIds: ids }, (states) =>
        useRealtimeStore.getState().setPresence(states),
      );
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    return () => {
      socket.off('connect', subscribe);
    };
  }, [key]);
}

// DM-1: the list of chats on the left (the whole screen on a phone)
export function Inbox() {
  const t = useTranslations('direct');
  const { data: me } = useMe();
  const pathname = usePathname();
  const [composing, setComposing] = useState(false);
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations();
  const { ref, inView } = useInView({ rootMargin: '300px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const conversations = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  usePresenceSubscription(
    conversations.flatMap((c) => (c.otherUser ? [c.otherUser.id] : [])).slice(0, 200),
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex h-18.75 shrink-0 items-center justify-between px-6 pt-4 max-md:h-14 max-md:px-4 max-md:pt-0">
        <h1 className="truncate text-xl font-bold">{me?.username ?? t('title')}</h1>
        <button
          type="button"
          onClick={() => setComposing(true)}
          aria-label={t('newMessage')}
          className="-mr-2 grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SquarePen className="size-6" />
        </button>
      </header>
      <h2 className="shrink-0 px-6 pt-2 pb-2.5 text-base font-bold max-md:px-4">{t('title')}</h2>

      <ul data-scrollable className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {isPending ? (
          Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex animate-pulse items-center gap-3 px-6 py-2 max-md:px-4">
              <div className="size-14 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
            </li>
          ))
        ) : isError ? (
          <li className="px-6 py-10 text-center text-sm text-muted-foreground">
            {t('inboxError')}
          </li>
        ) : conversations.length === 0 ? (
          <li className="px-6 py-10 text-center text-sm text-muted-foreground">
            {t('inboxEmpty')}
          </li>
        ) : (
          conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              myId={me?.id}
              active={pathname === `/direct/t/${conversation.id}`}
            />
          ))
        )}
        <li ref={ref} aria-hidden="true" />
      </ul>

      {composing && <NewMessageDialog open onOpenChange={setComposing} />}
    </section>
  );
}

function usePreviewText(conversation: ConversationPreview, myId: string | undefined) {
  const t = useTranslations('direct');
  const message = conversation.lastMessage;
  if (!message) return t('preview.noMessages');
  if (message.isDeleted) return t('preview.deleted');

  let text: string;
  switch (message.type) {
    case 'MEDIA':
      text = t('preview.photo');
      break;
    case 'POST_SHARE':
      text = t('preview.post');
      break;
    case 'STORY_REPLY':
      text = message.text ?? t('preview.story');
      break;
    case 'CALL':
      text = t('preview.call');
      break;
    case 'SYSTEM':
      return t('preview.system');
    default:
      text = message.text ?? '';
  }
  if (message.senderId === myId) return t('youSaid', { text });
  return conversation.isGroup ? `${message.senderUsername}: ${text}` : text;
}

function ConversationRow({
  conversation,
  myId,
  active,
}: {
  conversation: ConversationPreview;
  myId: string | undefined;
  active: boolean;
}) {
  const t = useTranslations('direct');
  const tTime = useTranslations('time');
  const preview = usePreviewText(conversation, myId);
  const typing = useTypingIn(conversation.id).length > 0;
  const unread = conversation.unreadCount > 0;
  const time = conversation.lastMessage ? shortTimeAgo(conversation.lastMessageAt) : null;

  return (
    <li className="relative">
      <Link
        href={`/direct/t/${conversation.id}`}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-6 py-2 outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6 max-md:px-4',
          active && 'bg-foreground/6 hover:bg-foreground/6',
        )}
      >
        <ConversationAvatar conversation={conversation} size={56} showPresence />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', unread && 'font-semibold')}>
            {conversation.title}
          </span>
          <span
            className={cn(
              'flex min-w-0 items-center gap-1 text-xs',
              unread ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {typing ? (
              <span className="truncate text-foreground">{t('typing')}</span>
            ) : (
              <>
                <span className="truncate">{preview}</span>
                {time && (
                  <span className="shrink-0 text-muted-foreground">
                    · {tTime(time.unit, { count: time.count })}
                  </span>
                )}
              </>
            )}
          </span>
        </span>
        {unread && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />}
      </Link>
      {/* The avatar's story ring opens the story (the rest of the row opens the chat) */}
      {conversation.otherUser && (
        <StoryHotspot
          user={conversation.otherUser}
          className="top-1/2 left-6 size-16 -translate-y-1/2"
        />
      )}
    </li>
  );
}
