'use client';

import type { Post } from '@instagram/shared';
import { Bookmark, Ellipsis, Heart, MessageCircle, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { shortTimeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { PostMedia } from './post-media';

const iconButton = 'transition-opacity hover:opacity-60';

// TODO(ENGAGE-1, ENGAGE-6): like / save actions — participant 1 (likes & comments task)
export function PostCard({ post }: { post: Post }) {
  const t = useTranslations('post');
  const tTime = useTranslations('time');
  const { author } = post;
  const time = shortTimeAgo(post.createdAt);

  return (
    <article className="border-b pb-5 max-md:border-b-0">
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

      <PostMedia media={post.media} />

      <div className="space-y-2 pt-3 text-sm max-md:px-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={t(post.isLiked ? 'unlike' : 'like')}
            className={iconButton}
          >
            <Heart className={cn('size-6', post.isLiked && 'fill-destructive text-destructive')} />
          </button>
          <Link href={`/p/${post.id}`} aria-label={t('comment')} className={iconButton}>
            <MessageCircle className="size-6 -scale-x-100" />
          </Link>
          <button type="button" aria-label={t('share')} className={iconButton}>
            <Send className="size-6" />
          </button>
          <button
            type="button"
            aria-label={t(post.isSaved ? 'unsave' : 'save')}
            className={cn(iconButton, 'ml-auto')}
          >
            <Bookmark className={cn('size-6', post.isSaved && 'fill-foreground')} />
          </button>
        </div>

        {post.likesCount > 0 && (
          <p className="font-semibold">{t('likes', { count: post.likesCount })}</p>
        )}

        {post.caption && (
          <p className="break-words whitespace-pre-line">
            <Link href={`/${author.username}`} className="mr-1 font-semibold">
              {author.username}
            </Link>
            {post.caption}
          </p>
        )}

        {post.commentsCount > 0 && (
          <Link href={`/p/${post.id}`} className="block text-muted-foreground">
            {t('viewAllComments', { count: post.commentsCount })}
          </Link>
        )}
      </div>
    </article>
  );
}
