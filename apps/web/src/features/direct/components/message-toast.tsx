'use client';

import type { Message } from '@instagram/shared';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { playMessagePing } from '@/lib/tones';

type Options = {
  message: Message;
  /** The chat's name: the sender, or the group */
  title: string;
  text: string;
  onOpen: () => void;
};

// PUSH-5: a new message while this tab is in front but another chat (or page) is open: a small
// card with who wrote and what, and a soft sound, instead of a system notification. A tap opens
// the chat. Messages of one chat replace each other's card.
export function showMessageToast({ message, title, text, onOpen }: Options) {
  playMessagePing();
  toast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          toast.dismiss(id);
          onOpen();
        }}
        className="flex w-[min(360px,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-foreground/10 bg-card/90 p-3 text-left text-card-foreground shadow-float-raised outline-none backdrop-blur-xl transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
      >
        <UserAvatar src={message.sender.avatarUrl} alt="" size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{text}</span>
        </span>
      </button>
    ),
    {
      id: `dm:${message.conversationId}`,
      duration: 4500,
      // The card is the whole toast: drop the pill frame every other toast gets (toaster.tsx)
      className:
        'rounded-none! border-0! bg-transparent! p-0! shadow-none! backdrop-blur-none! backdrop-saturate-100!',
    },
  );
}
