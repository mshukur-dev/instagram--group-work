'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CommentRow } from './comment-row';
import type { CommentItem } from '../api';
import { useReplies } from '../queries';

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  comment: CommentItem;
  postId: string;
  repliesDisabled: boolean;
  canDeleteAny: boolean;
  myId: string | undefined;
  expanded: boolean;
  onToggle: () => void;
  onReply: (comment: CommentItem) => void;
};

// A comment with its replies: "View 3 replies" opens them under the comment (ENGAGE-3)
export function CommentThread({
  comment,
  postId,
  repliesDisabled,
  canDeleteAny,
  myId,
  expanded,
  onToggle,
  onReply,
}: Props) {
  const t = useTranslations('comments');
  const reduceMotion = useReducedMotion();
  const pending = comment.id.startsWith('temp-');
  const replies = useReplies(comment.id, expanded && !pending);
  const items = replies.data?.pages.flatMap((page) => page.items) ?? [];
  const canDelete = (c: CommentItem) => canDeleteAny || c.author.id === myId;

  return (
    <div>
      <CommentRow
        comment={comment}
        postId={postId}
        repliesDisabled={repliesDisabled}
        canDelete={canDelete(comment)}
        onReply={onReply}
      />

      {comment.repliesCount > 0 && (
        <div className="pl-11">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex items-center gap-3 rounded-sm py-1 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <span aria-hidden="true" className="h-px w-6 bg-border" />
            {expanded ? t('hideReplies') : t('viewReplies', { count: comment.repliesCount })}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="replies"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease }}
                className="overflow-hidden"
              >
                <AnimatePresence initial={false}>
                  {items.map((reply) => (
                    <motion.div
                      key={reply.clientKey ?? reply.id}
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <CommentRow
                        comment={reply}
                        postId={postId}
                        small
                        repliesDisabled={repliesDisabled}
                        canDelete={canDelete(reply)}
                        onReply={onReply}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {replies.isPending && items.length === 0 && (
                  <div className="space-y-3 py-2" aria-hidden="true">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex animate-pulse gap-3">
                        <div className="size-6 rounded-full bg-muted" />
                        <div className="h-3 w-40 rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                )}

                {replies.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => void replies.fetchNextPage()}
                    disabled={replies.isFetchingNextPage}
                    className="flex items-center gap-3 rounded-sm py-1 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <span aria-hidden="true" className="h-px w-6 bg-border" />
                    {replies.isFetchingNextPage ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      t('moreReplies')
                    )}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
