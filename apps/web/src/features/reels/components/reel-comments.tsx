'use client';

import type { Post } from '@instagram/shared';
import { X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import type { CommentItem } from '@/features/comments/api';
import { CommentComposer, type ReplyTarget } from '@/features/comments/components/comment-composer';
import { CommentList } from '@/features/comments/components/comment-list';
import { useAddComment } from '@/features/comments/queries';
import { useMe } from '@/features/profile/queries';

// REELS-4: comments of a reel in a panel pinned to the right edge of the screen, so the video never
// moves (phone: a sheet over the video's lower part), with replies, likes and a new comment field.
export function ReelComments({ reel, onClose }: { reel: Post; onClose: () => void }) {
  const t = useTranslations('reels');
  const tPost = useTranslations('post');
  const { data: me } = useMe();
  const add = useAddComment(reel.id, me);
  const reduceMotion = useReducedMotion();
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const toggle = (commentId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(commentId)) next.add(commentId);
      return next;
    });

  const submit = (text: string, parentId?: string) => {
    add.mutate({ text, parentId });
    if (parentId) setExpanded((current) => new Set(current).add(parentId));
    else scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-y-4 right-5 z-30 flex w-100 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-float-raised max-md:absolute max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:z-10 max-md:h-2/3 max-md:w-full max-md:rounded-b-none"
    >
      <div className="relative flex h-13 shrink-0 items-center justify-center border-b border-border">
        <h2 className="font-semibold">{t('comments')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={tPost('close')}
          className="absolute right-3 grid size-8 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <CommentList
          post={reel}
          myId={me?.id}
          expanded={expanded}
          onToggle={toggle}
          onReply={(comment: CommentItem) =>
            setReplyTo({
              rootId: comment.parentId ?? comment.id,
              username: comment.author.username,
            })
          }
        />
      </div>

      {reel.commentsDisabled ? (
        <p className="shrink-0 border-t border-border px-4 py-4 text-center text-sm text-muted-foreground">
          {tPost('commentsOff')}
        </p>
      ) : (
        <CommentComposer
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSubmit={submit}
          inputRef={input}
        />
      )}
    </motion.aside>
  );
}
