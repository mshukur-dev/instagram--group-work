'use client';

import { ErrorCode, type Conversation } from '@instagram/shared';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { getErrorCode } from '@/lib/api-error';
import { shortTimeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';
import {
  useConversation,
  useDeleteMessage,
  useMarkRead,
  useMessages,
  useReact,
  useSendMessage,
} from '../queries';
import { usePresence, useRealtimeStore, useTypingIn } from '../realtime-store';
import { Composer } from './composer';
import { ConversationAvatar } from './conversation-avatar';
import { MessageRow } from './message-row';

// Messages further apart than this start a new run (new corners, the name again in groups)
const RUN_GAP_MS = 5 * 60_000;
// …and further apart than this get a time line between them
const SEPARATOR_GAP_MS = 60 * 60_000;

const usePageVisible = () => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
};

// DM-2: one conversation. The list is a column-reverse scroller: the browser keeps it pinned to
// the newest message by itself (no scroll math when messages arrive or the keyboard opens),
// and older pages load when the top is reached.
export function Thread({ id }: { id: string }) {
  const t = useTranslations('direct');
  const { data: me } = useMe();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const send = useSendMessage(id, me);
  const remove = useDeleteMessage(id);
  const react = useReact(id, me?.id);
  const markRead = useMarkRead(id, me?.id);
  const visible = usePageVisible();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const { ref: topRef, inView: atTop } = useInView({ rootMargin: '400px' });

  const items = useMemo(() => messages.data?.pages.flatMap((p) => p.items) ?? [], [messages.data]);

  // Messages already there when the chat opened (and older pages) appear without an entrance
  const settled = useRef<Set<string> | null>(null);
  if (settled.current === null && messages.data) {
    settled.current = new Set(items.map((m) => m.localKey ?? m.id));
  }
  useEffect(() => {
    const older = messages.data?.pages.slice(1).flatMap((p) => p.items) ?? [];
    older.forEach((m) => settled.current?.add(m.localKey ?? m.id));
  }, [messages.data]);

  useEffect(() => {
    useRealtimeStore.getState().setOpenConversation(id);
    return () => useRealtimeStore.getState().setOpenConversation(null);
  }, [id]);

  useEffect(() => {
    if (atTop && messages.hasNextPage && !messages.isFetchingNextPage)
      void messages.fetchNextPage();
  }, [atTop, messages]);

  // DM-7: what the other people wrote is read as soon as it is on screen
  const newestFromOthers = items.find((m) => m.sender.id !== me?.id && !m.status);
  const myLastRead = conversation.data?.members.find((m) => m.id === me?.id)?.lastReadAt;
  const markReadNow = markRead.mutate;
  useEffect(() => {
    if (!visible || !newestFromOthers || !myLastRead) return;
    if (new Date(newestFromOthers.createdAt) > new Date(myLastRead)) markReadNow();
  }, [visible, newestFromOthers, myLastRead, markReadNow]);

  // Stable callbacks, so memoised rows do not re-render on every keystroke
  const sendRef = useRef(send.mutate);
  sendRef.current = send.mutate;
  const onRetry = useCallback(
    (message: ChatMessage) =>
      sendRef.current({
        type: message.type as 'TEXT',
        text: message.text ?? undefined,
        mediaUrl: message.mediaUrl ?? undefined,
        mediaType: message.mediaType ?? undefined,
        clientId: message.clientId ?? crypto.randomUUID(),
        retryOf: message,
      }),
    [],
  );
  const reactRef = useRef(react.mutate);
  reactRef.current = react.mutate;
  const onReact = useCallback(
    (message: ChatMessage, emoji: string | null) => reactRef.current({ message, emoji }),
    [],
  );
  const removeRef = useRef(remove.mutate);
  removeRef.current = remove.mutate;
  const onUnsend = useCallback((message: ChatMessage) => removeRef.current(message), []);
  const onReply = useCallback((message: ChatMessage) => setReplyTo(message), []);

  const errorCode = conversation.error ? getErrorCode(conversation.error) : null;
  if (errorCode === ErrorCode.CONVERSATION_NOT_FOUND || errorCode === ErrorCode.NOT_A_MEMBER) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('conversationGone')}</p>
          <Link href="/direct/inbox" className="text-sm font-semibold text-brand">
            {t('goToInbox')}
          </Link>
        </div>
      </div>
    );
  }

  const data = conversation.data;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ThreadHeader conversation={data} myId={me?.id} />

      <div
        data-scrollable
        className="flex min-h-0 flex-1 flex-col-reverse overflow-x-hidden overflow-y-auto overscroll-contain pt-4 pb-2"
      >
        <TypingRow conversationId={id} conversation={data} />
        <SeenLine items={items} conversation={data} myId={me?.id} />
        {messages.isPending ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.isError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('loadFailed')}</p>
        ) : (
          items.map((message, i) => {
            const newer = items[i - 1];
            const older = items[i + 1];
            const gapOlder = older
              ? new Date(message.createdAt).getTime() - new Date(older.createdAt).getTime()
              : Infinity;
            const gapNewer = newer
              ? new Date(newer.createdAt).getTime() - new Date(message.createdAt).getTime()
              : Infinity;
            const separator = gapOlder > SEPARATOR_GAP_MS;
            const nextSeparated = gapNewer > SEPARATOR_GAP_MS;
            const key = message.localKey ?? message.id;
            return (
              <div key={key} className="flex flex-col">
                {separator && <TimeSeparator date={message.createdAt} />}
                <MessageRow
                  message={message}
                  mine={message.sender.id === me?.id}
                  isGroup={Boolean(data?.isGroup)}
                  first={
                    separator ||
                    !older ||
                    older.sender.id !== message.sender.id ||
                    older.type === 'SYSTEM' ||
                    gapOlder > RUN_GAP_MS
                  }
                  last={
                    nextSeparated ||
                    !newer ||
                    newer.sender.id !== message.sender.id ||
                    newer.type === 'SYSTEM' ||
                    gapNewer > RUN_GAP_MS
                  }
                  animateIn={settled.current !== null && !settled.current.has(key)}
                  myId={me?.id}
                  onReply={onReply}
                  onReact={onReact}
                  onUnsend={onUnsend}
                  onRetry={onRetry}
                />
              </div>
            );
          })
        )}
        {data && !messages.hasNextPage && !messages.isPending && (
          <ThreadIntro conversation={data} />
        )}
        <div ref={topRef} className="flex justify-center">
          {messages.isFetchingNextPage && (
            <Loader2 className="my-3 size-5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <Composer
        conversationId={id}
        replyTo={replyTo}
        myId={me?.id}
        onCancelReply={() => setReplyTo(null)}
        onSend={(input) => {
          send.mutate({ ...input, clientId: crypto.randomUUID(), replyToId: replyTo?.id });
          setReplyTo(null);
        }}
      />
    </section>
  );
}

function ThreadHeader({ conversation, myId }: { conversation?: Conversation; myId?: string }) {
  const t = useTranslations('direct');
  const tTime = useTranslations('time');
  const presence = usePresence(conversation?.otherUser?.id);
  const typing = useTypingIn(conversation?.id ?? '').filter((id) => id !== myId).length > 0;

  let status: string | null = null;
  if (typing) status = t('typing');
  else if (conversation?.isGroup) status = t('members', { count: conversation.members.length });
  else if (presence?.isOnline) status = t('activeNow');
  else if (presence?.lastSeenAt) {
    const ago = shortTimeAgo(presence.lastSeenAt);
    status = t('activeAgo', { time: tTime(ago.unit, { count: ago.count }) });
  }

  const other = conversation?.otherUser;
  const title = (
    <span className="min-w-0">
      <span className="block truncate text-base font-semibold">{conversation?.title}</span>
      <AnimatePresence mode="wait" initial={false}>
        {status && (
          <motion.span
            key={status}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="block truncate text-xs text-muted-foreground"
          >
            {status}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );

  return (
    <header className="flex h-18.75 shrink-0 items-center gap-3 border-b border-border/60 px-4 max-md:h-14 max-md:px-2">
      <Link
        href="/direct/inbox"
        aria-label={t('back')}
        className="grid size-10 place-items-center rounded-full md:hidden"
      >
        <ChevronLeft className="size-7" />
      </Link>
      {conversation ? (
        other ? (
          <Link href={`/${other.username}`} className="flex min-w-0 items-center gap-3">
            <ConversationAvatar conversation={conversation} size={44} showPresence />
            {title}
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            <ConversationAvatar conversation={conversation} size={44} />
            {title}
          </span>
        )
      ) : (
        <span className="flex animate-pulse items-center gap-3">
          <span className="size-11 rounded-full bg-muted" />
          <span className="h-3 w-28 rounded bg-muted" />
        </span>
      )}
    </header>
  );
}

// The top of a chat: who it is with, like Instagram's profile card at the start of a thread
function ThreadIntro({ conversation }: { conversation: Conversation }) {
  const other = conversation.otherUser;
  return (
    <div className="flex flex-col items-center gap-1 px-6 pt-6 pb-8 text-center">
      {other ? (
        <IntroAvatar user={other} />
      ) : (
        <ConversationAvatar conversation={conversation} size={96} />
      )}
      <p className="mt-3 text-xl font-semibold">{conversation.title}</p>
      {other && (
        <>
          <p className="text-sm text-muted-foreground">{other.fullName}</p>
          <Link
            href={`/${other.username}`}
            className="mt-3 rounded-lg bg-secondary px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-foreground/10"
          >
            {other.username}
          </Link>
        </>
      )}
    </div>
  );
}

// The big avatar at the top of a 1:1 chat: a thick story ring like on a profile, and with an
// active story a tap opens it over the chat (closing it comes back here)
function IntroAvatar({ user }: { user: NonNullable<Conversation['otherUser']> }) {
  const t = useTranslations('direct');
  const ring = user.hasUnseenStory ? 'unseen' : user.hasActiveStory ? 'seen' : 'none';
  const avatar = (
    <UserAvatar
      src={user.avatarUrl}
      alt={user.username}
      size={96}
      ring={ring}
      ringWidth="thick"
      // A wider ring for the big avatar, like the profile header's
      className={cn(ring !== 'none' && 'p-1')}
    />
  );
  if (!user.hasActiveStory) return avatar;
  return (
    <Link
      href={`/stories/${user.username}`}
      aria-label={t('openStory', { username: user.username })}
      className="rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
    >
      {avatar}
    </Link>
  );
}

function TimeSeparator({ date }: { date: string }) {
  const format = useFormatter();
  const value = new Date(date);
  const today = new Date().toDateString() === value.toDateString();
  return (
    <p className="mt-4 mb-2 text-center text-xs font-medium text-muted-foreground">
      {format.dateTime(
        value,
        today
          ? { hour: '2-digit', minute: '2-digit' }
          : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
      )}
    </p>
  );
}

// DM-7: "Seen" under my newest message once the other person (or everyone in a group) read it
function SeenLine({
  items,
  conversation,
  myId,
}: {
  items: ChatMessage[];
  conversation?: Conversation;
  myId?: string;
}) {
  const t = useTranslations('direct');
  const newest = items[0];
  if (!conversation || !newest || newest.sender.id !== myId || newest.status) return null;
  const at = new Date(newest.createdAt);
  const others = conversation.members.filter((m) => m.id !== myId);
  const readers = others.filter((m) => new Date(m.lastReadAt) >= at);
  if (readers.length === 0) return null;

  let text = t('seen');
  if (conversation.isGroup) {
    text =
      readers.length === others.length
        ? t('seenByEveryone')
        : t('seenBy', { names: readers.map((m) => m.username).join(', ') });
  }
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-5 pt-1 text-right text-xs text-muted-foreground"
    >
      {text}
    </motion.p>
  );
}

// DM-5: three dots in a bubble while someone types
function TypingRow({
  conversationId,
  conversation,
}: {
  conversationId: string;
  conversation?: Conversation;
}) {
  const { data: me } = useMe();
  const typing = useTypingIn(conversationId).filter((userId) => userId !== me?.id);
  const typer = conversation?.members.find((m) => m.id === typing[0]);

  return (
    <AnimatePresence>
      {typing.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          style={{ transformOrigin: '0% 100%' }}
          className="mt-2 flex items-end gap-2 px-4"
        >
          <span className="w-7 shrink-0">
            {typer && <UserAvatar src={typer.avatarUrl} alt="" size={28} />}
          </span>
          <span className="flex h-9 items-center gap-1 rounded-[22px] bg-secondary px-4">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className={cn('size-1.5 rounded-full bg-muted-foreground')}
                animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
              />
            ))}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
