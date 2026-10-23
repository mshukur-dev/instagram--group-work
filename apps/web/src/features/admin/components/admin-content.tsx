'use client';

import type { AdminComment, AdminPost, MediaType, PostType } from '@instagram/shared';
import { Copy, CornerDownRight, Heart, MessageCircle, Play, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { PostLink } from '@/features/posts/components/post-link';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { useAdminComments, useAdminPosts, useDeleteComment, useDeletePost } from '../queries';
import { AdminCard } from './admin-shell';
import { ListNote, LoadMore, Segmented, SkeletonRows, useTimeAgo } from './admin-ui';

type Kind = 'POST' | 'REEL' | 'COMMENT';

// ADMIN-5: the newest posts, reels and comments; any of them can be deleted
export function AdminContent() {
  const t = useTranslations('admin.content');
  const [kind, setKind] = useState<Kind>('POST');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
        <Segmented
          label={t('kindLabel')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'POST', label: t('kinds.posts') },
            { value: 'REEL', label: t('kinds.reels') },
            { value: 'COMMENT', label: t('kinds.comments') },
          ]}
        />
      </div>
      <AdminCard>
        {kind === 'COMMENT' ? <CommentList /> : <PostList key={kind} type={kind} />}
      </AdminCard>
    </div>
  );
}

/** Thumbnail of a post: the image, or a frame of the video */
function Preview({ url, type, size }: { url: string | null; type: MediaType; size: number }) {
  const box = 'shrink-0 overflow-hidden rounded-lg bg-muted';
  if (!url) return <span className={box} style={{ width: size, height: size }} />;
  const poster = type === 'VIDEO' && /\.(mp4|mov|webm)(\?|$)/i.test(url) ? videoPoster(url) : null;
  const isVideoFile = type === 'VIDEO' && /\.(mp4|mov|webm)(\?|$)/i.test(url) && !poster;
  return (
    <span className={cn(box, 'relative block')} style={{ width: size, height: size }}>
      {isVideoFile ? (
        <video src={url} muted preload="metadata" className="size-full object-cover" />
      ) : (
        <img
          src={poster ?? cldUrl(url, 'c_fill,w_160,h_160,f_auto,q_auto')}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      )}
    </span>
  );
}

function PostList({ type }: { type: PostType }) {
  const t = useTranslations('admin.content');
  const query = useAdminPosts(type);
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) return <SkeletonRows />;
  if (query.isError) return <ListNote>{t('loadFailed')}</ListNote>;
  if (posts.length === 0) return <ListNote>{t(type === 'REEL' ? 'noReels' : 'noPosts')}</ListNote>;

  return (
    <>
      <ul className="divide-y divide-border">
        {posts.map((post) => (
          <PostRow key={post.id} post={post} />
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

function PostRow({ post }: { post: AdminPost }) {
  const t = useTranslations('admin.content');
  const format = useFormatter();
  const timeAgo = useTimeAgo();
  const remove = useDeletePost(post.type);
  const [confirming, setConfirming] = useState(false);
  const isReel = post.type === 'REEL';

  return (
    <li className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-foreground/2">
      <PostLink
        postId={post.id}
        aria-label={t('openPost')}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Preview url={post.previewUrl} type={post.previewType} size={64} />
        {(isReel || post.mediaCount > 1) && (
          <span className="absolute top-1 right-1 text-white drop-shadow">
            {isReel ? <Play className="size-3.5 fill-current" /> : <Copy className="size-3.5" />}
          </span>
        )}
      </PostLink>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <UserAvatar src={post.author.avatarUrl} alt={post.author.username} size={20} />
          <span className="truncate font-semibold">{post.author.username}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
        </div>
        <p
          className={cn(
            'mt-1 line-clamp-2 text-sm wrap-break-word',
            !post.caption && 'text-muted-foreground italic',
          )}
        >
          {post.caption || t('noCaption')}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground tabular-nums max-md:hidden">
        <span className="flex items-center gap-1.5" title={t('likes')}>
          <Heart className="size-4" />
          {format.number(post.likesCount)}
        </span>
        <span className="flex items-center gap-1.5" title={t('comments')}>
          <MessageCircle className="size-4" />
          {format.number(post.commentsCount)}
        </span>
      </div>

      <DeleteButton
        label={t(isReel ? 'deleteReel' : 'deletePost')}
        onClick={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(isReel ? 'deleteReelTitle' : 'deletePostTitle', {
          username: post.author.username,
        })}
        description={t('deletePostBody')}
        picture={<Preview url={post.previewUrl} type={post.previewType} size={96} />}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => remove.mutate(post.id)}
      />
    </li>
  );
}

function CommentList() {
  const t = useTranslations('admin.content');
  const query = useAdminComments();
  const comments = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) return <SkeletonRows />;
  if (query.isError) return <ListNote>{t('loadFailed')}</ListNote>;
  if (comments.length === 0) return <ListNote>{t('noComments')}</ListNote>;

  return (
    <>
      <ul className="divide-y divide-border">
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

function CommentRow({ comment }: { comment: AdminComment }) {
  const t = useTranslations('admin.content');
  const timeAgo = useTimeAgo();
  const remove = useDeleteComment();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-foreground/2">
      <UserAvatar src={comment.author.avatarUrl} alt={comment.author.username} size={36} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{comment.author.username}</span>
          {comment.isReply && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" />
              {t('reply')}
            </span>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 wrap-break-word">{comment.text}</p>
      </div>
      <PostLink
        postId={comment.postId}
        aria-label={t('openPost')}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Preview url={comment.postPreviewUrl} type="IMAGE" size={44} />
      </PostLink>
      <DeleteButton label={t('deleteComment')} onClick={() => setConfirming(true)} />
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

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Trash2 className="size-4.5" />
    </button>
  );
}
