'use client';

import { Copy, Reply, Undo2 } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';

const QUICK = ['❤️', '😂', '😮', '😢', '😡', '👍'];

type Props = {
  message: ChatMessage | null;
  mine: boolean;
  myId: string | undefined;
  onClose: () => void;
  onReact: (message: ChatMessage, emoji: string | null) => void;
  onReply: (message: ChatMessage) => void;
  onUnsend: () => void;
};

// Phones have no hover, so a long press on a message opens this sheet: the reactions as a big
// row on top (the most used action), then reply / copy / unsend. Pulled down or tapped outside,
// it slides away.
export function MessageActionsSheet({
  message,
  mine,
  myId,
  onClose,
  onReact,
  onReply,
  onUnsend,
}: Props) {
  const t = useTranslations('direct');
  const current = message?.reactions.find((r) => r.userId === myId)?.emoji;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [message, onClose]);

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.y > 70 || info.velocity.y > 500) onClose();
  };

  const run = (action: () => void) => {
    action();
    onClose();
  };

  const row =
    'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[15px] font-medium outline-none transition-colors active:bg-foreground/8 focus-visible:bg-foreground/6';

  return createPortal(
    <AnimatePresence>
      {message && (
        <div className="fixed inset-0 z-90" role="presentation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t('messageActions')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 440, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-foreground/10 bg-card/90 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] shadow-float-raised outline-none backdrop-blur-2xl"
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-3 block h-1 w-10 rounded-full bg-foreground/20"
            />

            {/* Reactions: one tap, the chosen one again takes it back */}
            <div className="mb-2 flex justify-between rounded-2xl bg-foreground/5 p-1.5">
              {QUICK.map((emoji, i) => (
                <motion.button
                  key={emoji}
                  type="button"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 600,
                    damping: 22,
                    delay: 0.04 + i * 0.03,
                  }}
                  whileTap={{ scale: 1.35 }}
                  onClick={() => run(() => onReact(message, current === emoji ? null : emoji))}
                  aria-label={emoji}
                  aria-pressed={current === emoji}
                  className={cn(
                    'grid size-12 place-items-center rounded-full text-[28px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    current === emoji && 'bg-foreground/12',
                  )}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>

            <button type="button" onClick={() => run(() => onReply(message))} className={row}>
              <Reply className="size-5" />
              {t('reply')}
            </button>
            {message.type === 'TEXT' && message.text && (
              <button
                type="button"
                onClick={() =>
                  run(() => {
                    void navigator.clipboard
                      ?.writeText(message.text ?? '')
                      .then(() => toast.success(t('copied')));
                  })
                }
                className={row}
              >
                <Copy className="size-5" />
                {t('copy')}
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() => run(onUnsend)}
                className={cn(row, 'text-destructive')}
              >
                <Undo2 className="size-5" />
                {t('unsend')}
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
