'use client';

import { STORY_IMAGE_SECONDS } from '@instagram/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { UserAvatar } from '@/components/user-avatar';
import { cldUrl } from '@/lib/cloudinary';
import { shortTimeAgo } from '@/lib/time';
import { useMe } from '@/features/profile/queries';
import { useStoriesFeed, useUserStories, useViewStory } from '../queries';

// Round arrows next to the story (desktop only)
const arrowClass =
  'grid size-8 place-items-center rounded-full bg-neutral-100 text-black shadow-float transition-colors hover:bg-neutral-200 disabled:invisible max-md:hidden';

// STORY-3: full-screen viewer. Progress bars on top, a tap on the left third goes back,
// anywhere else goes forward; after the last story it moves on to the next person in the tray.
// The page around the story is always white (in both themes); whatever lies on the photo
// itself (bars, author, time) stays white, so it reads on any picture.
export function StoryViewer({ username }: { username: string }) {
  const t = useTranslations('stories');
  const tTime = useTranslations('time');
  const router = useRouter();
  const { data: stories, isError } = useUserStories(username);
  const { data: trays } = useStoriesFeed();
  const { data: me } = useMe();
  const markSeen = useViewStory().mutate;
  const [index, setIndex] = useState(0);

  const story = stories?.[index];

  // After the last story: the next person who still has unseen stories (never myself).
  // The tray re-sorts as stories get seen, so "the next one in the row" would keep changing.
  const others = trays?.filter((tray) => tray.user.username !== me?.username);
  const nextUser = others?.find((tray) => tray.hasUnseen && tray.user.username !== username)?.user
    .username;
  // Before the first story: the person to the left in the tray
  const position = trays?.findIndex((tray) => tray.user.username === username) ?? -1;
  const previousUser = position > 0 ? trays?.[position - 1]?.user.username : undefined;

  const close = () => router.push('/');

  const goNext = () => {
    if (stories && index < stories.length - 1) setIndex(index + 1);
    else if (nextUser) router.replace(`/stories/${nextUser}`);
    else close();
  };

  const goPrevious = () => {
    if (index > 0) setIndex(index - 1);
    else if (previousUser) router.replace(`/stories/${previousUser}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') goNext();
    if (event.key === 'ArrowLeft') goPrevious();
  };

  // Each story is marked as seen once it is on screen: the rings turn gray (STORY-4)
  useEffect(() => {
    if (story && !story.isSeen) markSeen(story.id);
  }, [story, markSeen]);

  // A photo stays for 5 seconds, a video for its own length
  const seconds = story?.mediaType === 'VIDEO' ? (story.duration ?? 15) : STORY_IMAGE_SECONDS;
  const time = story ? shortTimeAgo(story.createdAt) : null;

  return (
    <div
      // Focused on open, so the arrow keys and Esc work right away
      ref={(node) => node?.focus()}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-white text-black outline-none"
    >
      <Link href="/" className="absolute top-6 left-6 max-md:hidden">
        <InstagramWordmark className="h-8" />
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label={t('close')}
        className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full transition-colors hover:bg-black/5"
      >
        <X className="size-7" />
      </button>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0 && !previousUser}
          aria-label={t('previous')}
          className={arrowClass}
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="relative aspect-9/16 h-[min(92dvh,860px)] overflow-hidden rounded-xl bg-neutral-100 max-md:h-dvh max-md:rounded-none">
          {isError || (stories && stories.length === 0) ? (
            <p className="grid size-full place-items-center px-6 text-center text-sm text-neutral-500">
              {t('empty')}
            </p>
          ) : (
            story && (
              <>
                {story.mediaType === 'VIDEO' ? (
                  <video
                    key={story.id}
                    src={cldUrl(story.url, 'f_auto,q_auto')}
                    poster={story.thumbnailUrl ?? undefined}
                    autoPlay
                    muted
                    playsInline
                    className="size-full object-cover"
                  />
                ) : (
                  <img
                    key={story.id}
                    src={cldUrl(story.url, 'w_1080,f_auto,q_auto')}
                    alt=""
                    className="size-full object-cover"
                  />
                )}

                <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent" />

                {/* One bar per story. The running bar is the timer: when it fills up, the next story opens */}
                <div className="absolute inset-x-2 top-2 flex gap-1">
                  {stories?.map((item, i) => (
                    <span
                      key={item.id}
                      className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35"
                    >
                      {i < index && <span className="block size-full bg-white" />}
                      {i === index && (
                        <motion.span
                          key={item.id}
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: seconds, ease: 'linear' }}
                          onAnimationComplete={goNext}
                          className="block h-full bg-white"
                        />
                      )}
                    </span>
                  ))}
                </div>

                <div className="absolute top-5 left-3 flex items-center gap-2 text-sm text-white">
                  <UserAvatar src={story.author.avatarUrl} alt={story.author.username} size={32} />
                  <Link href={`/${story.author.username}`} className="font-semibold">
                    {story.author.username}
                  </Link>
                  {time && (
                    <span className="text-white/70">{tTime(time.unit, { count: time.count })}</span>
                  )}
                </div>

                {/* Invisible tap zones over the photo: left third back, the rest forward */}
                <button
                  type="button"
                  onClick={goPrevious}
                  aria-label={t('previous')}
                  className="absolute inset-y-16 left-0 w-1/3"
                />
                <button
                  type="button"
                  onClick={goNext}
                  aria-label={t('next')}
                  className="absolute inset-y-16 right-0 w-2/3"
                />
              </>
            )
          )}
        </div>

        <button type="button" onClick={goNext} aria-label={t('next')} className={arrowClass}>
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
