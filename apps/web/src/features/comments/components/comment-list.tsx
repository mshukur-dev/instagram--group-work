'use client';

import type { Post } from '@instagram/shared';
import { Loader2, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import type { CommentItem } from '../api';
import { useComments } from '../queries';
import { CommentThread } from './comment-thread';

const ease = [0.22, 1, 0.36, 1] as const;

// The first screenful rises one by one; a comment added later grows into place from nothing
type Custom = { delay: number; grow: boolean };
const item: Variants = {
  enter: ({ grow }: Custom) => (grow ? { opacity: 0, height: 0 } : { opacity: 0, y: 10 }),
  in: ({ delay }: Custom) => ({
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { delay, duration: 0.4, ease },
  }),
  out: { opacity: 0, height: 0, transition: { duration: 0.25, ease } },
};

type Props = {
  post: Post;
  myId: string | undefined;
  expanded: ReadonlySet<string>;
  onToggle: (commentId: string) => void;
  onReply: (comment: CommentItem) => void;
};

// ENGAGE-2: top-level comments, newest first, more load while scrolling
export function CommentList({ post, myId, expanded, onToggle, onReply }: Props) {
  const t = useTranslations('comments');
  const reduceMotion = useReducedMotion();
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useComments(post.id);
  const { ref, inView } = useInView({ rootMargin: '200px' });
  const comments = data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The comments that were there when the list first appeared get the staggered entrance
  const [firstScreen, setFirstScreen] = useState<ReadonlySet<string> | null>(null);
  if (firstScreen === null && data) {
    setFirstScreen(new Set(comments.map((c) => c.clientKey ?? c.id)));
  }

  if (isPending) {
    return (
      <div className="space-y-4 py-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse gap-3">
            <div className="size-8 shrink-0 rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <p>{t('loadFailed')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-sm font-semibold text-brand outline-none hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="flex flex-col items-center gap-3 px-6 py-12 text-center"
      >
        <span className="grid size-14 place-items-center rounded-full border-2 border-foreground/80">
          <MessageCircle className="size-7 -scale-x-100" />
        </span>
        <div className="space-y-1">
          <p className="text-lg font-semibold">
            {t(post.commentsDisabled ? 'disabledTitle' : 'emptyTitle')}
          </p>
          {!post.commentsDisabled && (
            <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <ul>
        <AnimatePresence initial={!reduceMotion}>
          {comments.map((comment, index) => {
            const key = comment.clientKey ?? comment.id;
            const initial = firstScreen?.has(key) ?? false;
            const custom: Custom = {
              delay: initial ? Math.min(index, 8) * 0.04 : 0,
              grow: !initial,
            };
            return (
              <motion.li
                key={key}
                custom={custom}
                variants={item}
                initial="enter"
                animate="in"
                exit="out"
                className="-mx-2 overflow-hidden px-2"
              >
                <CommentThread
                  comment={comment}
                  postId={post.id}
                  repliesDisabled={post.commentsDisabled}
                  canDeleteAny={post.author.id === myId}
                  myId={myId}
                  expanded={expanded.has(comment.id)}
                  onToggle={() => onToggle(comment.id)}
                  onReply={onReply}
                />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div ref={ref} className="grid h-10 place-items-center">
        {isFetchingNextPage && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>
    </>
  );
}
