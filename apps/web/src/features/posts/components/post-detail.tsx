'use client';

import type { Post } from '@instagram/shared';
import { ChevronLeft, MessageCircle, Send } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { useAddComment } from '@/features/comments/queries';
import type { CommentItem } from '@/features/comments/api';
import { CommentComposer, type ReplyTarget } from '@/features/comments/components/comment-composer';
import { CommentList } from '@/features/comments/components/comment-list';
import { useMe } from '@/features/profile/queries';
import { shortTimeAgo } from '@/lib/time';
import { useIsPhone, useViewportSize } from '@/lib/use-viewport';
import { cn } from '@/lib/utils';
import { useLikePost, useSavePost } from '../queries';
import { renderCaption } from './caption';
import { iconButtonBase } from './icon-button';
import { LikeButton } from './like-button';
import { LikesCount } from './likes-count';
import { PostMedia, postMediaRatio } from './post-media';
import { PostMenu } from './post-menu';
import { SaveButton } from './save-button';

const SIDEBAR = 124;
const GUTTER = 24;
const MIN_HEIGHT = 540;

// Size of the card on a desktop: as tall as the window allows, as wide as the photo needs.
// Wide photos are limited by the width left on the screen and then get a little taller than
// their own shape (the photo is cropped a bit, like in the feed).
export function usePostBox(post: Post, variant: 'modal' | 'page') {
  const { width, height } = useViewportSize();
  const ratio = postMediaRatio(post.media);
  const panel = width >= 1280 ? 420 : 360;
  const room = width - GUTTER * 2 - (variant === 'page' ? SIDEBAR : 0);
  const maxHeight = Math.min(height - GUTTER * 2, 860);
  const maxPane = Math.min(room - panel, 820);

  let pane = maxHeight * ratio;
  let box = maxHeight;
  if (pane > maxPane) {
    pane = maxPane;
    box = Math.min(Math.max(pane / ratio, MIN_HEIGHT), maxHeight);
  }
  return { ratio, panel, pane: Math.round(pane), height: Math.round(box) };
}

type Props = {
  post: Post;
  /** `modal`: over the page (the parts are animated from outside); `page`: a page of its own */
  variant: 'modal' | 'page';
  /** Phone: the arrow at the top left */
  onBack?: () => void;
  onDeleted: () => void;
};

// POST-6: a post with its comments. Desktop: photo on the left, a panel on the right (author,
// caption and comments, actions, the field for a new comment). Phone: one column, the field for
// a new comment stays at the bottom. The parts carry data-part so the modal can animate them.
export function PostDetail({ post, variant, onBack, onDeleted }: Props) {
  const t = useTranslations('post');
  const tTime = useTranslations('time');
  const format = useFormatter();
  const { data: me } = useMe();
  const like = useLikePost(post.id);
  const save = useSavePost(post.id);
  const add = useAddComment(post.id, me);
  const isPhone = useIsPhone();
  const box = usePostBox(post, variant);

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

  const reply = (comment: CommentItem) =>
    setReplyTo({ rootId: comment.parentId ?? comment.id, username: comment.author.username });

  const submit = (text: string, parentId?: string) => {
    add.mutate({ text, parentId });
    if (parentId) {
      // Show the thread the answer lands in
      setExpanded((current) => new Set(current).add(parentId));
    } else {
      scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const created = new Date(post.createdAt);
  const sameYear = created.getFullYear() === new Date().getFullYear();
  const time = shortTimeAgo(post.createdAt);

  return (
    <div
      data-part="card"
      className={cn(
        // isolate: the background layer below (-z-10) stays under every part of the card, also
        // on a phone, where the panel's parts are laid out without a wrapper of their own
        'relative isolate flex',
        'max-md:min-h-full max-md:w-full max-md:flex-col',
        variant === 'page' && 'max-md:min-h-0',
      )}
      style={isPhone ? undefined : { width: box.pane + box.panel, height: box.height }}
    >
      {/* The card's own background is a layer, so the photo can fly in from outside the card */}
      <div
        data-part="bg"
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 rounded-2xl bg-card max-md:rounded-none',
          variant === 'modal' ? 'shadow-float-raised' : 'border border-border/60',
        )}
      />

      <div
        data-part="pane"
        className="relative z-[1] shrink-0 overflow-hidden rounded-l-2xl bg-muted max-md:order-2 max-md:rounded-none"
        style={isPhone ? { aspectRatio: box.ratio } : { width: box.pane }}
      >
        <PostMedia media={post.media} fill onDoubleTap={() => !post.isLiked && like.mutate(true)} />
      </div>

      <div
        data-part="panel"
        className="relative z-[1] flex min-w-0 flex-1 flex-col max-md:contents"
      >
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border/60 px-4 max-md:sticky max-md:top-0 max-md:z-10 max-md:order-1 max-md:bg-card">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('back')}
              className={cn(iconButtonBase, 'md:hidden')}
            >
              <ChevronLeft className="size-6" />
            </button>
          )}
          <Link href={`/${post.author.username}`} className="shrink-0">
            <UserAvatar
              src={post.author.avatarUrl}
              alt={post.author.username}
              size={32}
              ring={
                post.author.hasUnseenStory ? 'unseen' : post.author.hasActiveStory ? 'seen' : 'none'
              }
            />
          </Link>
          <Link
            href={`/${post.author.username}`}
            className="min-w-0 flex-1 truncate text-sm font-semibold"
          >
            {post.author.username}
          </Link>
          <PostMenu post={post} onDeleted={onDeleted} />
        </header>

        <div
          ref={scroller}
          data-scrollable
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 max-md:order-4 max-md:overflow-visible"
        >
          {post.caption && (
            <div className="flex gap-3 pb-2">
              <Link href={`/${post.author.username}`} className="shrink-0 self-start">
                <UserAvatar src={post.author.avatarUrl} alt={post.author.username} size={32} />
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <p className="break-words whitespace-pre-line">
                  <Link href={`/${post.author.username}`} className="mr-1 font-semibold">
                    {post.author.username}
                  </Link>
                  {renderCaption(post.caption)}
                </p>
                <time
                  dateTime={post.createdAt}
                  className="mt-1 block text-xs text-muted-foreground"
                >
                  {tTime(time.unit, { count: time.count })}
                </time>
              </div>
            </div>
          )}
          <CommentList
            post={post}
            myId={me?.id}
            expanded={expanded}
            onToggle={toggle}
            onReply={reply}
          />
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-border/60 px-4 pt-3 pb-3 max-md:order-3 max-md:border-t-0 max-md:pb-1">
          <div className="flex items-center gap-4">
            <LikeButton liked={post.isLiked} onToggle={(next) => like.mutate(next)} />
            <button
              type="button"
              aria-label={t('comment')}
              onClick={() => input.current?.focus()}
              className={iconButtonBase}
            >
              <MessageCircle className="size-6 -scale-x-100" />
            </button>
            <button type="button" aria-label={t('share')} className={iconButtonBase}>
              <Send className="size-6" />
            </button>
            <SaveButton
              saved={post.isSaved}
              onToggle={(next) => save.mutate(next)}
              className="ml-auto"
            />
          </div>
          {post.likesCount > 0 ? (
            <LikesCount count={post.likesCount} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('beFirstToLike')}</p>
          )}
          <time dateTime={post.createdAt} className="block text-xs text-muted-foreground">
            {format.dateTime(created, {
              month: 'long',
              day: 'numeric',
              ...(sameYear ? {} : { year: 'numeric' }),
            })}
          </time>
        </div>

        <div className="max-md:sticky max-md:bottom-0 max-md:z-10 max-md:order-5 max-md:bg-card md:contents">
          {post.commentsDisabled ? (
            <p className="shrink-0 border-t border-border/60 px-4 py-4 text-center text-sm text-muted-foreground">
              {t('commentsOff')}
            </p>
          ) : (
            <CommentComposer
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSubmit={submit}
              inputRef={input}
            />
          )}
        </div>
      </div>
    </div>
  );
}
