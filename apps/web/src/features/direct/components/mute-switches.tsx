'use client';

import type { Conversation, MuteConversationInput } from '@instagram/shared';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMuteChat } from '../queries';

// The (i) panel's "Notifications" part: mute this chat's messages and / or calls, for me only
export function MuteSwitches({ conversation }: { conversation: Conversation }) {
  const t = useTranslations('direct.details');
  const mute = useMuteChat(conversation.id);
  const set = (input: MuteConversationInput) =>
    mute.mutate(input, { onError: () => toast.error(t('failed')) });

  return (
    <section className="border-t border-border/60 py-2">
      <SwitchRow
        label={t('muteMessages')}
        hint={t('muteMessagesHint')}
        on={conversation.muted.messages}
        onChange={(messages) => set({ messages })}
      />
      <SwitchRow
        label={t('muteCalls')}
        hint={t('muteCallsHint')}
        on={conversation.muted.calls}
        onChange={(calls) => set({ calls })}
      />
    </section>
  );
}

function SwitchRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-4 px-6 py-3 text-left outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          on ? 'justify-end bg-foreground' : 'justify-start bg-foreground/15',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 35 }}
          className="size-6 rounded-full bg-background shadow-sm"
        />
      </span>
    </button>
  );
}
