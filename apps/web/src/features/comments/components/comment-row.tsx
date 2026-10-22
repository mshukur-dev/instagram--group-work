'use client';

import { Ellipsis } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { renderCaption } from '@/features/posts/components/caption';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { shortTimeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { CommentItem } from '../api';
import { useDeleteComment, useLikeComment } from '../queries';
import { CommentLike } from './comment-like';

type Props = {
  comment: CommentItem;
  postId: string;
  /** Replies get a smaller avatar */
  small?: boolean;
  repliesDisabled: boolean;
  canDelete: boolean;
  onReply: (comment: CommentItem) => void;
};

// One comment or reply: avatar, name + text, then time, likes, "Reply" and (when allowed) delete
export function CommentRow({ comment, postId, small, repliesDisabled, canDelete, onReply }: Props) {
  const t = useTranslations('comments');
  const tTime = useTranslations('time');
  const reduceMotion = useReducedMotion();
  const like = useLikeComment(comment.id);
  const remove = useDeleteComment(postId);
  const [confirming, setConfirming] = useState(false);
  const time = shortTimeAgo(comment.createdAt);
  // Not saved yet: it cannot be liked or answered until the server has given it an id
  const pending = comment.id.startsWith('temp-');
  const mine = comment.clientKey !== undefined;

  return (
    <div
      className={cn('group relative flex gap-3 py-2 transition-opacity', pending && 'opacity-60')}
    >
      {/* A comment I just wrote glows softly for a moment, so the eye finds it */}
      {mine && !reduceMotion && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-2 inset-y-0 rounded-xl bg-brand/10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut', delay: 0.2 }}
        />
      )}

      <Link href={`/${comment.author.username}`} className="relative shrink-0 self-start">
        <UserAvatar
          src={comment.author.avatarUrl}
          alt={comment.author.username}
          size={small ? 24 : 32}
        />
      </Link>

      <div className="relative min-w-0 flex-1 text-sm">
        <p className="break-words whitespace-pre-line">
          <Link href={`/${comment.author.username}`} className="mr-1 font-semibold">
            {comment.author.username}
          </Link>
          {renderCaption(comment.text)}
        </p>
        <div className="mt-1 flex h-4 items-center gap-3 text-xs text-muted-foreground">
          <time dateTime={comment.createdAt}>{tTime(time.unit, { count: time.count })}</time>
          {comment.likesCount > 0 && (
            <span className="font-semibold">{t('likes', { count: comment.likesCount })}</span>
          )}
          {!pending && !repliesDisabled && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="rounded-sm font-semibold outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {t('reply')}
            </button>
          )}
          {canDelete && !pending && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={t('more')}
              className="rounded-sm outline-none transition-[opacity,color] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
            >
              <Ellipsis className="size-4" />
            </button>
          )}
        </div>
      </div>

      <CommentLike
        liked={comment.isLiked}
        disabled={pending}
        onToggle={(next) => like.mutate(next)}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('deleteTitle')}
        description={t(comment.parentId ? 'deleteReplyBody' : 'deleteBody')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => remove.mutate({ comment })}
      />
    </div>
  );
}
