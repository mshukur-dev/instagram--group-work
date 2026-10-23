'use client';

import { Phone, Video, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { ConversationAvatar } from '@/features/direct/components/conversation-avatar';
import { useIsClient } from '@/lib/use-is-client';
import { useCallStore } from '../call-store';
import { useCallActions } from '../queries';

// CALL-5: someone started a call in one of my groups. A quiet banner at the top, not a ringing
// dialog: join now, or dismiss it (the chat keeps its "Join" button while the call goes on).
export function GroupCallBanners() {
  const invites = useCallStore((s) => s.groupInvites);
  const inCall = useCallStore((s) => s.session !== null);
  const dropGroupInvite = useCallStore((s) => s.dropGroupInvite);
  const { join } = useCallActions();
  const t = useTranslations('calls');
  const isClient = useIsClient();
  if (!isClient) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-90 flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {!inCall &&
          invites.map(({ call, conversation, caller }) => (
            <motion.div
              key={call.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role="status"
              className="pointer-events-auto flex w-full max-w-105 items-center gap-3 rounded-2xl border border-foreground/10 bg-card/85 py-2.5 pr-2.5 pl-3 shadow-float-raised backdrop-blur-xl"
            >
              <ConversationAvatar conversation={conversation} size={40} />
              <span className="min-w-0 flex-1 text-sm leading-tight">
                <span className="block truncate">
                  {t.rich(call.type === 'VIDEO' ? 'groupStartedVideo' : 'groupStartedAudio', {
                    name: caller.username,
                    b: (chunks) => <b className="font-semibold">{chunks}</b>,
                  })}
                </span>
                <span className="block truncate text-muted-foreground">{conversation.title}</span>
              </span>
              <button
                type="button"
                onClick={() => void join(call.id, conversation)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 text-sm font-semibold text-white outline-none transition-[filter,scale] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
              >
                {call.type === 'VIDEO' ? (
                  <Video className="size-4" />
                ) : (
                  <Phone className="size-4" />
                )}
                {t('join')}
              </button>
              <button
                type="button"
                onClick={() => dropGroupInvite(call.id)}
                aria-label={t('dismiss')}
                className="grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
