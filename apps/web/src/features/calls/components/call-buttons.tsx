'use client';

import type { Conversation } from '@instagram/shared';
import { Phone, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallStore } from '../call-store';
import { useCallActions } from '../queries';

const iconButton =
  'grid size-10 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';

// CALL-1 / 2 / 4 / 5: audio and video call buttons in a chat's header. While a group call is
// going on they turn into one green "Join" pill with a live dot.
export function CallButtons({ conversation }: { conversation: Conversation }) {
  const t = useTranslations('calls');
  const { start, join } = useCallActions();
  const inCall = useCallStore((s) => s.session !== null);
  const active = conversation.activeCall;

  if (conversation.isGroup && active) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => void join(active.id, conversation)}
        disabled={inCall}
        className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-3.5 text-sm font-semibold text-white outline-none transition-[filter,scale] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-60"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        {t('join')}
      </motion.button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void start(conversation, 'AUDIO')}
        disabled={inCall}
        aria-label={t('audioCall')}
        title={t('audioCall')}
        className={iconButton}
      >
        <Phone className="size-6" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => void start(conversation, 'VIDEO')}
        disabled={inCall}
        aria-label={t('videoCall')}
        title={t('videoCall')}
        className={iconButton}
      >
        <Video className="size-6.5" strokeWidth={1.8} />
      </button>
    </>
  );
}
