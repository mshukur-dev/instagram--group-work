'use client';

import { Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { useHashtag, useHashtagPosts } from '../queries';
import { PostTile } from './post-tile';

const bold = (chunks: React.ReactNode) => <span className="font-semibold">{chunks}</span>;

// SEARCH-2: /explore/tags/:tag — the tag, how many posts have it, and those posts newest first
export function HashtagPage({ name }: { name: string }) {
  const t = useTranslations('search');
  const { data: hashtag } = useHashtag(name);
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useHashtagPosts(name);
  const { ref, inView } = useInView({ rootMargin: '600px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  // The newest post is the tag's picture, like Instagram
  const cover = posts[0]?.media[0];
  const coverImage =
    cover && (cover.type === 'VIDEO' ? (cover.thumbnailUrl ?? videoPoster(cover.url)) : cover.url);

  return (
    <div className="mx-auto w-full max-w-233.75 px-5 pt-8 pb-10 max-md:px-0 max-md:pt-4">
      <header className="flex items-center gap-20 pb-11 max-md:gap-6 max-md:px-4 max-md:pb-6">
        <div className="flex w-50 justify-center max-md:w-auto">
          <span className="grid size-37.5 place-items-center overflow-hidden rounded-full border border-border bg-muted max-md:size-19.25">
            {coverImage ? (
              <img
                src={cldUrl(coverImage, 'c_fill,w_300,h_300,f_auto,q_auto')}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Hash className="size-14 max-md:size-8" strokeWidth={1.5} />
            )}
          </span>
        </div>
        <div className="min-w-0 space-y-3">
          <h1 className="truncate text-2xl font-semibold max-md:text-xl">
            #{hashtag?.name ?? name}
          </h1>
          {hashtag && <p>{t.rich('postsCountBold', { count: hashtag.postsCount, b: bold })}</p>}
        </div>
      </header>

      {isPending ? (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-3/4 animate-pulse bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('tagError')}</p>
      ) : posts.length === 0 ? (
        <p className="border-t border-border py-16 text-center font-semibold">{t('tagEmpty')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {posts.map((post) => (
            <PostTile key={post.id} post={post} />
          ))}
        </div>
      )}
      <div ref={ref} />
    </div>
  );
}
