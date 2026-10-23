'use client';

import type { AdminComment, AdminPost, MediaType, PostType } from '@instagram/shared';
import {
  Camera,
  Clapperboard,
  Copy,
  Grid3x3,
  Heart,
  MessageCircle,
  Play,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { PostLink } from '@/features/posts/components/post-link';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { useAdminComments, useAdminPosts, useDeleteComment, useDeletePost } from '../queries';
import { AdminTitle } from './admin-shell';
import {
  EmptyState,
  ListNote,
  LoadMore,
  RowsSkeleton,
  SearchField,
  useDebounced,
  useTimeAgo,
} from './admin-ui';

type Kind = 'POST' | 'REEL' | 'COMMENT';

const kinds = [
  { key: 'POST', label: 'posts', icon: Grid3x3 },
  { key: 'REEL', label: 'reels', icon: Clapperboard },
  { key: 'COMMENT', label: 'comments', icon: MessageCircle },
] as const;

// ADMIN-5: the newest posts, reels and comments, searchable; any of them can be deleted.
// Laid out like a profile: the same tabs, the same grid of tiles.
export function AdminContent() {
  const t = useTranslations('admin.content');
  const tTabs = useTranslations('admin.tabs');
  const [kind, setKind] = useState<Kind>('POST');
  const [input, setInput] = useState('');
  const q = useDebounced(input);

  return (
    <>
      <AdminTitle>{tTabs('content')}</AdminTitle>

      <SearchField
        value={input}
        onChange={setInput}
        placeholder={t(kind === 'COMMENT' ? 'searchComments' : 'searchPosts')}
        className="mb-6 max-md:mx-4"
      />

      <nav
        aria-label={t('kindLabel')}
        className="flex justify-center gap-14 border-t border-border max-md:justify-around max-md:gap-0"
      >
        {kinds.map(({ key, label, icon: Icon }) => {
          const active = kind === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(key)}
              className={cn(
                'relative flex h-13 items-center gap-1.5 text-xs font-semibold tracking-wider uppercase outline-none transition-colors duration-300 focus-visible:text-foreground',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-content-tab-line"
                  transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                  className="absolute inset-x-0 -top-px h-px bg-foreground"
                />
              )}
              <Icon className="size-3 max-md:size-6" strokeWidth={active ? 2.5 : 2} />
              <span className="max-md:hidden">{t(`kinds.${label}`)}</span>
            </button>
          );
        })}
      </nav>

      {kind === 'COMMENT' ? <CommentList q={q} /> : <PostGrid key={kind} type={kind} q={q} />}
    </>
  );
}

const isVideoFile = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url);

/** The picture of a post: the image, or a still of the video */
function Cover({
  url,
  type,
  transformation,
}: {
  url: string;
  type: MediaType;
  transformation: string;
}) {
  if (!url) return null;
  if (type === 'VIDEO' && isVideoFile(url)) {
    const poster = videoPoster(url);
    if (!poster) {
      return <video src={url} muted preload="metadata" className="size-full object-cover" />;
    }
    return <img src={poster} alt="" loading="lazy" className="size-full object-cover" />;
  }
  return (
    <img
      src={cldUrl(url, transformation)}
      alt=""
      loading="lazy"
      draggable={false}
      className="size-full object-cover"
    />
  );
}

function PostGrid({ type, q }: { type: PostType; q: string }) {
  const t = useTranslations('admin.content');
  const query = useAdminPosts(type, q);
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];
  const isReel = type === 'REEL';
  const grid = cn('grid gap-1', isReel ? 'grid-cols-4 max-md:grid-cols-3' : 'grid-cols-3');

  if (query.isPending) {
    return (
      <div className={grid} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={cn('animate-pulse bg-muted', isReel ? 'aspect-9/16' : 'aspect-3/4')}
          />
        ))}
      </div>
    );
  }
  if (query.isError) return <ListNote>{t('loadFailed')}</ListNote>;
  if (posts.length === 0) {
    return q ? (
      <ListNote>{t('noResults', { q })}</ListNote>
    ) : (
      <EmptyState icon={isReel ? Clapperboard : Camera} title={t(isReel ? 'noReels' : 'noPosts')} />
    );
  }

  return (
    <>
      <div className={cn(grid, 'transition-opacity', query.isPlaceholderData && 'opacity-60')}>
        {posts.map((post) => (
          <PostTile key={post.id} post={post} />
        ))}
      </div>
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </>
  );
}

// A profile tile plus what a moderator needs: whose post it is, and a delete button
function PostTile({ post }: { post: AdminPost }) {
  const t = useTranslations('admin.content');
  const remove = useDeletePost(post.type);
  const [confirming, setConfirming] = useState(false);
  const isReel = post.type === 'REEL';

  return (
    <div className="group relative">
      <PostLink
        postId={post.id}
        aria-label={t('openPost', { username: post.author.username })}
        className={cn(
          'relative block overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isReel ? 'aspect-9/16' : 'aspect-3/4',
        )}
      >
        <Cover
          url={post.previewUrl}
          type={post.previewType}
          transformation={
            isReel ? 'c_fill,w_300,h_533,f_auto,q_auto' : 'c_fill,w_400,h_533,f_auto,q_auto'
          }
        />

        {/* Overlays sit on the photo, so they stay white in both themes */}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-black/50 to-transparent px-2 pt-6 pb-2 text-xs font-semibold text-white">
          <UserAvatar src={post.author.avatarUrl} alt="" size={20} />
          <span className="truncate drop-shadow">{post.author.username}</span>
        </span>
        {isReel ? (
          <Play className="absolute top-2 left-2 size-4 fill-white text-white drop-shadow" />
        ) : (
          post.mediaCount > 1 && (
            <Copy className="absolute top-2 left-2 size-4.5 text-white drop-shadow" />
          )
        )}

        <span className="absolute inset-0 flex items-center justify-center gap-6 bg-black/30 font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1.5">
            <Heart className="size-5 fill-white" />
            {post.likesCount}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-5 -scale-x-100 fill-white" />
            {post.commentsCount}
          </span>
        </span>
      </PostLink>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t(isReel ? 'deleteReel' : 'deletePost')}
        title={t(isReel ? 'deleteReel' : 'deletePost')}
        className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-black/50 text-white opacity-0 outline-none backdrop-blur-sm transition-[opacity,background-color] group-hover:opacity-100 hover:bg-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white max-md:size-7 max-md:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(isReel ? 'deleteReelTitle' : 'deletePostTitle', {
          username: post.author.username,
        })}
        description={t('deletePostBody')}
        picture={
          <span className="block size-24 overflow-hidden rounded-lg bg-muted">
            <Cover
              url={post.previewUrl}
              type={post.previewType}
              transformation="c_fill,w_200,h_200,f_auto,q_auto"
            />
          </span>
        }
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => remove.mutate(post.id)}
      />
    </div>
  );
}

function CommentList({ q }: { q: string }) {
  const t = useTranslations('admin.content');
  const query = useAdminComments(q);
  const comments = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <div className="pt-4 max-md:px-4">
        <RowsSkeleton />
      </div>
    );
  }
  if (query.isError) return <ListNote>{t('loadFailed')}</ListNote>;
  if (comments.length === 0) {
    return q ? (
      <ListNote>{t('noResults', { q })}</ListNote>
    ) : (
      <EmptyState icon={MessageCircle} title={t('noComments')} />
    );
  }

  return (
    <>
      <ul
        className={cn(
          'pt-2 transition-opacity max-md:px-4',
          query.isPlaceholderData && 'opacity-60',
        )}
      >
        {comments.map((comment) => (
          <CommentRow key={comment.id} comment={comment} />
        ))}
      </ul>
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </>
  );
}

// Reads like a comment under a post: name and text in one line, time below
function CommentRow({ comment }: { comment: AdminComment }) {
  const t = useTranslations('admin.content');
  const timeAgo = useTimeAgo();
  const remove = useDeleteComment();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="group flex items-start gap-3 py-2.5">
      <UserAvatar src={comment.author.avatarUrl} alt={comment.author.username} size={32} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="wrap-break-word">
          <span className="mr-1.5 font-semibold">{comment.author.username}</span>
          {comment.text}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {timeAgo(comment.createdAt)}
          {comment.isReply && ` · ${t('reply')}`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t('deleteComment')}
        title={t('deleteComment')}
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 outline-none transition-[opacity,color] group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring max-md:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
      <PostLink
        postId={comment.postId}
        aria-label={t('openPost', { username: comment.author.username })}
        className="size-11 shrink-0 overflow-hidden rounded bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {comment.postPreviewUrl && (
          <Cover
            url={comment.postPreviewUrl}
            type={isVideoFile(comment.postPreviewUrl) ? 'VIDEO' : 'IMAGE'}
            transformation="c_fill,w_100,h_100,f_auto,q_auto"
          />
        )}
      </PostLink>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('deleteCommentTitle', { username: comment.author.username })}
        description={comment.isReply ? t('deleteReplyBody') : t('deleteCommentBody')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => remove.mutate(comment.id)}
      />
    </li>
  );
}
