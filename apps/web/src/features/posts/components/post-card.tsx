'use client';

import type { Post } from '@instagram/shared';
import { Ellipsis, MessageCircle, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { shortTimeAgo } from '@/lib/time';
import { useLikePost, useSavePost } from '../queries';
import { Caption } from './caption';
import { LikeButton } from './like-button';
import { LikesCount } from './likes-count';
import { PostMedia } from './post-media';
import { SaveButton } from './save-button';

const iconButton = 'transition-[opacity,transform] hover:opacity-60 active:scale-90';

// ENGAGE-1, ENGAGE-6: like and save are optimistic (queries.ts)
export function PostCard({ post }: { post: Post }) {
  const t = useTranslations('post');
  const like = useLikePost(post.id);
  const save = useSavePost(post.id);
  const tTime = useTranslations('time');
  const { author } = post;
  const time = shortTimeAgo(post.createdAt);

  return (
    // No divider line between posts (it was a bright line in the dark theme): spacing does the job
    <article className="pb-6">
      <header className="flex items-center gap-3 pb-3 max-md:px-3">
        <Link href={`/${author.username}`}>
          <UserAvatar
            src={author.avatarUrl}
            alt={author.username}
            size={32}
            ring={author.hasUnseenStory ? 'unseen' : author.hasActiveStory ? 'seen' : 'none'}
          />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          <Link href={`/${author.username}`} className="truncate font-semibold">
            {author.username}
          </Link>
          <span className="text-muted-foreground">•</span>
          <time dateTime={post.createdAt} className="shrink-0 text-muted-foreground">
            {tTime(time.unit, { count: time.count })}
          </time>
        </div>
        <button type="button" aria-label={t('more')} className={iconButton}>
          <Ellipsis className="size-5" />
        </button>
      </header>

      {/* Double tap on the photo likes it (it never takes a like back, as in Instagram) */}
      <PostMedia media={post.media} onDoubleTap={() => !post.isLiked && like.mutate(true)} />

      <div className="space-y-2 pt-3 text-sm max-md:px-3">
        <div className="flex items-center gap-4">
          <LikeButton liked={post.isLiked} onToggle={(next) => like.mutate(next)} />
          <Link href={`/p/${post.id}`} aria-label={t('comment')} className={iconButton}>
            <MessageCircle className="size-6 -scale-x-100" />
          </Link>
          <button type="button" aria-label={t('share')} className={iconButton}>
            <Send className="size-6" />
          </button>
          <SaveButton
            saved={post.isSaved}
            onToggle={(next) => save.mutate(next)}
            className="ml-auto"
          />
        </div>

        <LikesCount count={post.likesCount} />

        {post.caption && <Caption username={author.username} text={post.caption} />}

        {post.commentsCount > 0 && (
          <Link href={`/p/${post.id}`} className="block text-muted-foreground">
            {t('viewAllComments', { count: post.commentsCount })}
          </Link>
        )}
      </div>
    </article>
  );
}
