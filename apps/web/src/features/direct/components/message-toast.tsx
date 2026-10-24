'use client';

import type { Message } from '@instagram/shared';
import { Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { playMessagePing } from '@/lib/tones';

const DURATION_MS = 5000;

type Options = {
  message: Message;
  /** The chat's name: the sender, or the group */
  title: string;
  text: string;
  onOpen: () => void;
};

// PUSH-5: a new message while this tab is on screen but another chat (or page) is open: a card
// at the bottom with who wrote and what, and a soft sound, instead of a system
// notification. A tap opens the chat. Messages of one chat replace each other's card.
export function showMessageToast({ message, title, text, onOpen }: Options) {
  playMessagePing();
  toast.custom(
    (id) => (
      <MessageCard
        avatarUrl={message.sender.avatarUrl}
        title={title}
        text={text}
        onOpen={() => {
          toast.dismiss(id);
          onOpen();
        }}
        onClose={() => toast.dismiss(id)}
      />
    ),
    {
      id: `dm:${message.conversationId}`,
      duration: DURATION_MS,
      // The card is the whole toast: drop the pill frame every other toast gets (toaster.tsx)
      className:
        'rounded-none! border-0! bg-transparent! p-0! shadow-none! backdrop-blur-none! backdrop-saturate-100! w-auto! max-w-none!',
    },
  );
}

function MessageCard({
  avatarUrl,
  title,
  text,
  onOpen,
  onClose,
}: {
  avatarUrl: string | null;
  title: string;
  text: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('direct.toast');
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <div className="group/card relative w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[20px] bg-popover/90 text-popover-foreground shadow-float-raised ring-1 ring-foreground/8 backdrop-blur-2xl backdrop-saturate-150">
      {/* Not a <button>: Sonner starts a swipe only on elements that aren't buttons, and this
          is the whole card. A swipe that ends on it must not count as a tap. */}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(event) => {
          down.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={(event) => {
          const start = down.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
          onOpen();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
        className="flex w-full cursor-pointer items-start gap-3 p-3.5 pr-10 text-left outline-none focus-visible:bg-foreground/4"
      >
        {/* The sender, with a small paper plane in the Direct colors: this is a message */}
        <span className="relative shrink-0">
          <UserAvatar src={avatarUrl} alt="" size={44} />
          <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-dm-mine text-white ring-2 ring-popover">
            <Send className="size-2.5 -translate-x-px translate-y-px" strokeWidth={2.6} />
          </span>
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{t('now')}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-foreground/80">
            {text}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 outline-none transition-[opacity,background-color] group-hover/card:opacity-100 hover:bg-foreground/8 focus-visible:opacity-100 max-md:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
