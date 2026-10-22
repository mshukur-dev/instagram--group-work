'use client';

import { COMMENT_MAX } from '@instagram/shared';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;
const MAX_INPUT_HEIGHT = 112;

export type ReplyTarget = {
  /** Top-level comment whose thread the answer joins */
  rootId: string;
  username: string;
};

type Props = {
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  onSubmit: (text: string, parentId?: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

// "Add a comment…": grows with the text, Enter sends, Shift+Enter starts a new line. Answering
// a comment shows who is being answered and puts their @name in front.
export function CommentComposer({ replyTo, onCancelReply, onSubmit, inputRef }: Props) {
  const t = useTranslations('comments');
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && text.length <= COMMENT_MAX;

  const fit = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  };

  // Pressing "Reply" prefills the @name and moves the cursor to the end
  const replyKey = replyTo ? `${replyTo.rootId}:${replyTo.username}` : '';
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !replyTo) return;
    setText((current) => (current.trim() === '' ? `@${replyTo.username} ` : current));
    input.focus();
    requestAnimationFrame(() => {
      input.setSelectionRange(input.value.length, input.value.length);
      fit(input);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the target changes
  }, [replyKey]);

  const send = () => {
    if (!canSend) return;
    onSubmit(trimmed, replyTo?.rootId);
    setText('');
    onCancelReply();
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="shrink-0"
    >
      <AnimatePresence initial={false}>
        {replyTo && (
          <motion.div
            key="replying"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 bg-secondary/60 px-4 py-2 text-xs text-muted-foreground">
              <span className="truncate">{t('replyingTo', { username: replyTo.username })}</span>
              <button
                type="button"
                onClick={() => {
                  onCancelReply();
                  setText((current) => (current.trim() === `@${replyTo.username}` ? '' : current));
                }}
                aria-label={t('cancelReply')}
                className="grid size-5 place-items-center rounded-full outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-3 border-t border-border/60 px-4 py-3">
        <textarea
          ref={inputRef}
          value={text}
          rows={1}
          maxLength={COMMENT_MAX + 50}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          onChange={(event) => {
            setText(event.target.value);
            fit(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          className="max-h-28 min-h-5 flex-1 resize-none bg-transparent py-0.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
        />
        {text.length > COMMENT_MAX * 0.9 && (
          <span
            className={cn(
              'self-center text-xs tabular-nums',
              text.length > COMMENT_MAX ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {COMMENT_MAX - text.length}
          </span>
        )}
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            'rounded-sm py-0.5 text-sm font-semibold text-brand outline-none transition-[opacity,color,translate] duration-200 hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring/60',
            canSend ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-1 opacity-0',
          )}
        >
          {t('post')}
        </button>
      </div>
    </form>
  );
}
