'use client';

import type { Message } from '@instagram/shared';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { TOAST_CARD_FRAME, ToastCard } from '@/components/toast-card';
import { playMessagePing } from '@/lib/tones';

const DURATION_MS = 5000;

/** Someone reacted to my message while another chat (or page) is open: the emoji on the avatar */
export function showReactionToast(options: {
  conversationId: string;
  actor: { username: string; avatarUrl: string | null };
  emoji: string;
  text: string;
  onOpen: () => void;
}) {
  toast.custom(
    (id) => (
      <ToastCard
        avatarUrl={options.actor.avatarUrl}
        badge={<span className="text-[11px] leading-none">{options.emoji}</span>}
        badgeClassName="bg-popover"
        title={options.actor.username}
        text={options.text}
        onOpen={() => {
          toast.dismiss(id);
          options.onOpen();
        }}
        onClose={() => toast.dismiss(id)}
      />
    ),
    { id: `react:${options.conversationId}`, duration: DURATION_MS, className: TOAST_CARD_FRAME },
  );
}

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
      <ToastCard
        avatarUrl={message.sender.avatarUrl}
        // A small paper plane in the Direct colors: this is a message
        badge={<Send className="size-2.5 -translate-x-px translate-y-px" strokeWidth={2.6} />}
        badgeClassName="bg-dm-mine"
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
      className: TOAST_CARD_FRAME,
    },
  );
}
