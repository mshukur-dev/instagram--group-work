'use client';

import type { Post } from '@instagram/shared';
import { Clapperboard, Copy, Heart, MessageCircle, Play } from 'lucide-react';
import { useFormatter } from 'next-intl';
import { PostLink } from '@/features/posts/components/post-link';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

// A post in a grid (Top, hashtag page); a click opens it over the page, or calls `onOpen`.
// `href` is where a new tab (Ctrl / middle click) goes. Tall tiles are reels and show views.
export function PostTile({
  post,
  tall = false,
  href,
  onOpen,
}: {
  post: Post;
  tall?: boolean;
  href?: string;
  onOpen?: () => void;
}) {
  const format = useFormatter();
  const cover = post.media[0];
  const image =
    cover?.type === 'VIDEO' ? (cover.thumbnailUrl ?? videoPoster(cover.url)) : cover?.url;
  const CornerIcon = post.media.length > 1 ? Copy : cover?.type === 'VIDEO' ? Clapperboard : null;
  const compact = (n: number) => format.number(n, { notation: 'compact' });

  return (
    <PostLink
      postId={post.id}
      href={href}
      modal={!href}
      onClick={(event) => {
        const plain =
          event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
        if (!onOpen || !plain) return;
        event.preventDefault();
        onOpen();
      }}
      data-post-origin={post.id}
      className={cn(
        'group relative block overflow-hidden bg-muted',
        tall ? 'aspect-9/16' : 'aspect-3/4',
      )}
    >
      {image && (
        <img
          src={cldUrl(
            image,
            tall ? 'c_fill,w_400,h_711,f_auto,q_auto' : 'c_fill,w_400,h_533,f_auto,q_auto',
          )}
          alt={post.caption ?? ''}
          loading="lazy"
          className="size-full object-cover"
        />
      )}

      {/* Overlays sit on the picture, so they stay white in both themes */}
      {tall ? (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
          <Play className="size-4 fill-white" />
          {compact(post.viewsCount)}
        </span>
      ) : (
        CornerIcon && (
          <CornerIcon className="absolute top-2 right-2 size-5 text-white drop-shadow" />
        )
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-6 bg-black/30 font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1.5">
          <Heart className="size-5 fill-white" />
          {compact(post.likesCount)}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-5 -scale-x-100 fill-white" />
          {compact(post.commentsCount)}
        </span>
      </div>
    </PostLink>
  );
}
