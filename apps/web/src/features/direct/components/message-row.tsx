'use client';

import type { UserPreview } from '@instagram/shared';
import { CircleAlert, Phone, PhoneMissed, Reply, Smile, Undo2, Video } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { PostLink } from '@/features/posts/components/post-link';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';
import { MediaStack, MediaThumb } from './media-stack';
import { MessageActionsSheet } from './message-actions-sheet';

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

// A text of up to three emoji is shown big, without a bubble (like Instagram)
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*\s*){1,3}$/u;

// Holding a finger on a message this long opens its actions (phones have no hover)
const LONG_PRESS_MS = 450;

function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(12);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    // Moving the finger means scrolling, not pressing
    onPointerMove: (event: React.PointerEvent) => {
      const from = start.current;
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // No system menu over the message, and the tap that ends a long press opens nothing
    onContextMenu: (event: React.MouseEvent) => {
      if (fired.current || start.current) event.preventDefault();
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (!fired.current) return;
      event.preventDefault();
      event.stopPropagation();
      fired.current = false;
    },
  };
}

type Props = {
  message: ChatMessage;
  /** Photos sent together, oldest first, shown as one pile (`message` is the newest of them) */
  stack?: ChatMessage[];
  mine: boolean;
  isGroup: boolean;
  /** Top / bottom of a run of messages from the same person: rounder corners there */
  first: boolean;
  last: boolean;
  /** Plays the entrance (only messages that arrive while the chat is open) */
  animateIn: boolean;
  myId: string | undefined;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string | null) => void;
  onUnsend: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
};

// One message. The bubble's corners join runs of messages; hovering shows react / reply /
// unsend; a double click puts a heart on it. Memoised: a new message re-renders only its row.
export const MessageRow = memo(function MessageRow(props: Props) {
  const { message, mine, isGroup, first, last, animateIn } = props;
  const t = useTranslations('direct');
  const reduceMotion = useReducedMotion();
  // The phone's action sheet: mounted on the first long press, then kept so it can slide out
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const canAct = !message.isDeleted && !message.status && message.type !== 'CALL';
  const press = useLongPress(() => {
    if (!canAct) return;
    setSheetMounted(true);
    setSheetOpen(true);
  });
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  if (message.type === 'SYSTEM') return <SystemLine message={message} />;

  const sender = message.sender;
  const showAvatar = !mine && last;
  // A reply already names its sender in "maria replied to …"
  const showName = isGroup && !mine && first && !(message.replyTo && !message.isDeleted);

  return (
    <motion.div
      initial={animateIn && !reduceMotion ? { opacity: 0, y: 10, scale: 0.94 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      style={{ transformOrigin: mine ? '100% 100%' : '0% 100%' }}
      className={cn('group/row flex items-end gap-2 px-4', first ? 'mt-2' : 'mt-0.5')}
    >
      {!mine && (
        <span className="w-7 shrink-0">
          {showAvatar && (
            <Link href={`/${sender.username}`} aria-label={sender.username}>
              <UserAvatar src={sender.avatarUrl} alt="" size={28} />
            </Link>
          )}
        </span>
      )}

      <div className={cn('flex min-w-0 flex-1 flex-col', mine ? 'items-end' : 'items-start')}>
        {showName && <p className="mb-0.5 px-3 text-xs text-muted-foreground">{sender.username}</p>}
        {message.replyTo && !message.isDeleted && (
          <ReplyQuote message={message} mine={mine} myId={props.myId} />
        )}
        <div
          className={cn(
            'flex max-w-[min(78%,460px)] items-center gap-1',
            mine && 'flex-row-reverse',
          )}
        >
          <div
            {...press}
            className="min-w-0 transition-transform duration-200 pointer-coarse:select-none pointer-coarse:active:scale-97 [-webkit-touch-callout:none]"
          >
            <Body {...props} />
          </div>
          {message.status === 'failed' ? (
            <button
              type="button"
              onClick={() => props.onRetry(message)}
              aria-label={t('failed')}
              title={t('failed')}
              className="grid size-7 shrink-0 place-items-center rounded-full text-destructive"
            >
              <CircleAlert className="size-5" />
            </button>
          ) : (
            !message.isDeleted &&
            !message.status &&
            message.type !== 'CALL' && <HoverActions {...props} />
          )}
        </div>
        <Reactions message={message} myId={props.myId} onReact={props.onReact} />
      </div>

      {sheetMounted && (
        <MessageActionsSheet
          message={sheetOpen ? message : null}
          mine={mine}
          myId={props.myId}
          onClose={closeSheet}
          onReact={props.onReact}
          onReply={props.onReply}
          onUnsend={() => (props.stack ?? [message]).forEach(props.onUnsend)}
        />
      )}
    </motion.div>
  );
});

function Body(props: Props) {
  const { message, mine, first, last } = props;
  const t = useTranslations('direct');
  const [burst, setBurst] = useState(0);

  // Joined corners: a run of bubbles reads as one block
  const corners = mine
    ? cn('rounded-[22px]', !first && 'rounded-tr-md', !last && 'rounded-br-md')
    : cn('rounded-[22px]', !first && 'rounded-tl-md', !last && 'rounded-bl-md');

  const heart = () => {
    // A click on a photo opens it, so a double click there is not a like
    if (message.isDeleted || message.status || message.type === 'MEDIA') return;
    const mineNow = message.reactions.find((r) => r.userId === props.myId)?.emoji;
    props.onReact(message, mineNow === '❤️' ? null : '❤️');
    if (mineNow !== '❤️') setBurst((n) => n + 1);
  };

  let content: React.ReactNode;
  if (message.isDeleted) {
    content = (
      <p
        className={cn(
          corners,
          'border border-border px-3.5 py-2 text-sm text-muted-foreground italic',
        )}
      >
        {t('deletedMessage')}
      </p>
    );
  } else if (message.type === 'CALL' && message.call) {
    content = <CallBubble message={message} className={corners} />;
  } else if (props.stack && props.stack.length > 1) {
    content = <MediaStack messages={props.stack} mine={mine} />;
  } else if (message.type === 'MEDIA' && message.mediaUrl) {
    content = <MediaThumb message={message} />;
  } else if (message.type === 'POST_SHARE') {
    content = <SharedPost message={message} />;
  } else {
    const text = message.text ?? '';
    const emojiOnly = EMOJI_ONLY.test(text.trim());
    content = (
      <>
        {message.type === 'STORY_REPLY' && <StoryReply message={message} mine={mine} />}
        {emojiOnly ? (
          <p className="px-1 text-4xl leading-tight">{text}</p>
        ) : (
          <p
            className={cn(
              corners,
              'px-3.5 py-2 text-[15px] leading-5 wrap-break-word whitespace-pre-wrap',
              mine ? 'bg-dm-mine text-white' : 'bg-secondary text-secondary-foreground',
            )}
          >
            {text}
          </p>
        )}
      </>
    );
  }

  return (
    <div
      onDoubleClick={heart}
      className={cn(
        'relative flex min-w-0 flex-col select-text',
        mine ? 'items-end' : 'items-start',
        message.status === 'sending' && 'opacity-75',
        message.status === 'failed' && 'opacity-80',
      )}
    >
      {content}
      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={burst}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1, 1.1] }}
            transition={{ duration: 0.7, times: [0, 0.3, 0.7, 1] }}
            onAnimationComplete={() => setBurst(0)}
            className="pointer-events-none absolute inset-0 grid place-items-center text-3xl"
          >
            ❤️
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReplyQuote({
  message,
  mine,
  myId,
}: {
  message: ChatMessage;
  mine: boolean;
  myId?: string;
}) {
  const t = useTranslations('direct');
  const quoted = message.replyTo;
  if (!quoted) return null;
  const sender = mine ? t('you') : message.sender.username;
  const target = quoted.senderId === myId ? t('you').toLowerCase() : quoted.senderUsername;
  return (
    <div
      className={cn(
        'mb-1 flex max-w-[min(78%,460px)] flex-col',
        mine ? 'items-end' : 'items-start',
      )}
    >
      <span className="mb-1 px-1 text-xs text-muted-foreground">
        {quoted.senderId === message.sender.id
          ? mine
            ? t('repliedToYourself')
            : t('repliedToThemself', { sender })
          : t('repliedTo', { sender, username: target })}
      </span>
      {/* The quoted message, faded, with a thin line on the side it belongs to */}
      <span className={cn('flex items-stretch gap-1.5', mine && 'flex-row-reverse')}>
        <span aria-hidden="true" className="w-0.75 shrink-0 rounded-full bg-foreground/15" />
        <p className="line-clamp-2 rounded-[18px] bg-foreground/5 px-3 py-1.5 text-sm text-muted-foreground">
          {quoted.isDeleted ? t('deletedMessage') : (quoted.text ?? t('preview.photo'))}
        </p>
      </span>
    </div>
  );
}

function SharedPost({ message }: { message: ChatMessage }) {
  const t = useTranslations('direct');
  const post = message.post;
  if (!post) {
    return (
      <p className="rounded-[22px] border border-border px-3.5 py-2 text-sm text-muted-foreground">
        {t('postUnavailable')}
      </p>
    );
  }
  const cover = post.media[0];
  const image = cover?.type === 'VIDEO' ? cover.thumbnailUrl : cover?.url;
  return (
    <PostLink
      postId={post.id}
      className="block w-60 overflow-hidden rounded-[22px] bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2 px-3 py-2.5">
        <UserAvatar src={post.author.avatarUrl} alt="" size={24} />
        <span className="truncate text-sm font-semibold">{post.author.username}</span>
      </span>
      {image && (
        <img
          src={cldUrl(image, 'c_fill,w_480,h_480,f_auto,q_auto')}
          alt=""
          loading="lazy"
          className="aspect-square w-full object-cover"
        />
      )}
      {post.caption && (
        <span className="line-clamp-2 px-3 py-2 text-sm">
          <span className="mr-1 font-semibold">{post.author.username}</span>
          {post.caption}
        </span>
      )}
    </PostLink>
  );
}

function StoryReply({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const t = useTranslations('direct');
  const story = message.story;
  const image = story ? (story.mediaType === 'VIDEO' ? story.thumbnailUrl : story.url) : null;
  return (
    <div className={cn('mb-1 flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <span className="px-1 text-xs text-muted-foreground">
        {mine ? t('storyReplyMine') : t('storyReplyTheirs')}
      </span>
      {image ? (
        <img
          src={cldUrl(image, 'c_fill,w_220,h_390,f_auto,q_auto')}
          alt=""
          loading="lazy"
          className="aspect-9/16 w-27.5 rounded-2xl bg-muted object-cover"
        />
      ) : (
        <span className="rounded-2xl border border-border px-3 py-6 text-xs text-muted-foreground">
          {t('storyUnavailable')}
        </span>
      )}
    </div>
  );
}

function CallBubble({ message, className }: { message: ChatMessage; className: string }) {
  const t = useTranslations('direct');
  const call = message.call;
  if (!call) return null;
  const missed = call.status === 'MISSED';
  const Icon = missed ? PhoneMissed : call.type === 'VIDEO' ? Video : Phone;
  let duration = '';
  if (call.answeredAt && call.endedAt) {
    const total = Math.max(
      0,
      Math.round((new Date(call.endedAt).getTime() - new Date(call.answeredAt).getTime()) / 1000),
    );
    duration = t('call.duration', {
      minutes: Math.floor(total / 60),
      seconds: String(total % 60).padStart(2, '0'),
    });
  }
  return (
    <p className={cn(className, 'flex items-center gap-3 bg-secondary px-4 py-2.5 text-sm')}>
      <span
        className={cn(
          'grid size-8 place-items-center rounded-full',
          missed ? 'bg-destructive/15 text-destructive' : 'bg-foreground/10',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block font-semibold">
          {missed ? t('call.missed') : call.type === 'VIDEO' ? t('call.video') : t('call.audio')}
        </span>
        {duration && <span className="block text-xs text-muted-foreground">{duration}</span>}
      </span>
    </p>
  );
}

function SystemLine({ message }: { message: ChatMessage }) {
  const t = useTranslations('direct');
  const data = message.systemData;
  if (!data) return null;
  const names = (users: UserPreview[]) => users.map((u) => u.username).join(', ');
  return (
    <p className="my-3 px-8 text-center text-xs text-muted-foreground">
      {t(`system.${data.action}`, {
        actor: data.actor.username,
        targets: names(data.targets),
        title: data.title ?? '',
      })}
    </p>
  );
}

function Reactions({
  message,
  myId,
  onReact,
}: {
  message: ChatMessage;
  myId?: string;
  onReact: Props['onReact'];
}) {
  if (message.reactions.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of message.reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const mine = message.reactions.find((r) => r.userId === myId)?.emoji;
  return (
    <motion.button
      type="button"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 26 }}
      onClick={() => mine && onReact(message, null)}
      className="relative z-1 -mt-1.5 mx-2 flex items-center gap-0.5 rounded-full border border-background bg-secondary px-1.5 py-0.5 text-xs shadow-sm"
    >
      {[...counts.entries()].map(([emoji]) => (
        <span key={emoji}>{emoji}</span>
      ))}
      {message.reactions.length > 1 && (
        <span className="ml-0.5 text-muted-foreground">{message.reactions.length}</span>
      )}
    </motion.button>
  );
}

function HoverActions({ message, stack, mine, myId, onReply, onReact, onUnsend }: Props) {
  const t = useTranslations('direct');
  const [picking, setPicking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = message.reactions.find((r) => r.userId === myId)?.emoji;

  // The reaction bar closes on any click outside it
  useEffect(() => {
    if (!picking) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setPicking(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [picking]);

  const action =
    'grid size-7 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div
      ref={box}
      className={cn(
        'relative flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 pointer-coarse:hidden',
        picking && 'opacity-100',
        mine && 'flex-row-reverse',
      )}
    >
      <button
        type="button"
        onClick={() => setPicking((v) => !v)}
        aria-label={t('react')}
        className={action}
      >
        <Smile className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onReply(message)}
        aria-label={t('reply')}
        className={action}
      >
        <Reply className="size-4" />
      </button>
      {mine && (
        <button
          type="button"
          onClick={() => (stack ?? [message]).forEach(onUnsend)}
          aria-label={t('unsend')}
          className={action}
        >
          <Undo2 className="size-4" />
        </button>
      )}

      <AnimatePresence>
        {picking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ type: 'spring', stiffness: 640, damping: 32 }}
            className={cn(
              'absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-foreground/10 bg-card/80 p-1 shadow-float-raised backdrop-blur-xl',
              mine ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
            )}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(message, current === emoji ? null : emoji);
                  setPicking(false);
                }}
                className={cn(
                  'grid size-9 place-items-center rounded-full text-xl transition-transform outline-none hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring',
                  current === emoji && 'bg-foreground/10',
                )}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
