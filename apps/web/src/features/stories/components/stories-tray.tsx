'use client';

import { IMAGE_MAX_BYTES, type Me, type StoryTray, VIDEO_MAX_BYTES } from '@instagram/shared';
import useEmblaCarousel from 'embla-carousel-react';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { useCreateStory, useStoriesFeed } from '../queries';

// Width of the fade at an edge, in px (it grows from 0 as the row is scrolled away from that edge)
const FADE = 40;

// Rings above the feed: colored when there are unseen stories (FEED-3, STORY-4).
// The row can be dragged or swiped with momentum; an edge that still has stories behind it fades
// out instead of cutting the avatars off. Nothing reacts to a plain hover.
export function StoriesTray() {
  const { data: allTrays } = useStoriesFeed();
  const { data: me } = useMe();
  // My own stories get the first circle ("Your story"), so they are taken out of the list
  const myTray = allTrays?.find((tray) => tray.user.id === me?.id);
  const trays = allTrays?.filter((tray) => tray.user.id !== me?.id);
  const [viewport, embla] = useEmblaCarousel({
    dragFree: true,
    containScroll: 'trimSnaps',
    align: 'start',
    duration: 28,
  });

  // The fade follows the scroll position frame by frame (written straight to CSS variables,
  // no React state): the first px of scrolling already fade the left edge in, the last px
  // before the end fade the right edge out, so there is never a hard cut or a late effect.
  useEffect(() => {
    const root = embla?.rootNode();
    const track = embla?.containerNode();
    if (!embla || !root || !track) return;

    const update = () => {
      const overflow = Math.max(0, track.scrollWidth - root.clientWidth);
      const scrolled = embla.scrollProgress() * overflow;
      const start = Math.min(FADE, scrolled);
      const end = Math.min(FADE, overflow - scrolled);
      root.style.setProperty('--fade-start', `${Math.max(0, start).toFixed(1)}px`);
      root.style.setProperty('--fade-end', `${Math.max(0, end).toFixed(1)}px`);
    };

    update();
    embla.on('scroll', update).on('reInit', update).on('resize', update).on('settle', update);
    return () => {
      embla.off('scroll', update).off('reInit', update).off('resize', update).off('settle', update);
    };
  }, [embla, trays?.length]);

  // Trackpad / shift+wheel: a horizontal scroll moves the row by one story (the row is moved by
  // transforms, so the browser has nothing to scroll natively)
  useEffect(() => {
    const node = embla?.rootNode();
    if (!embla || !node) return;
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) < 8 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (locked) return;
      locked = true;
      window.setTimeout(() => (locked = false), 220);
      if (event.deltaX > 0) embla.scrollNext();
      else embla.scrollPrev();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [embla]);

  if (!me) return null;

  return (
    <div className="mb-6 max-md:mb-2 max-md:px-3">
      <div ref={viewport} className="edge-fade overflow-hidden py-2">
        <div className="flex cursor-grab touch-pan-y gap-2 active:cursor-grabbing">
          <YourStory me={me} myTray={myTray} />
          {trays?.map(({ user, hasUnseen }) => (
            <Link
              key={user.id}
              href={`/stories/${user.username}`}
              draggable={false}
              className="group flex w-22.5 shrink-0 select-none flex-col items-center gap-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {/* Only a press reacts (a small squeeze), a hover does nothing */}
              <span className="transition-transform duration-150 ease-out group-active:scale-95 motion-reduce:transition-none">
                <UserAvatar
                  src={user.avatarUrl}
                  alt={user.username}
                  size={74}
                  ring={hasUnseen ? 'unseen' : 'seen'}
                  ringWidth="thick"
                />
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-xs',
                  hasUnseen ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {user.username}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// STORY-1: the first circle. With my own story it opens the viewer; without one there is no ring
// and a tap picks a photo or video. The blue "+" always adds a new story.
function YourStory({ me, myTray }: { me: Me; myTray?: StoryTray }) {
  const t = useTranslations('stories');
  const createStory = useCreateStory();
  const input = useRef<HTMLInputElement>(null);

  const pickFile = () => input.current?.click();

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const limit = file.type.startsWith('video/') ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
    if (file.size > limit) {
      toast(t('tooLarge'));
      return;
    }
    createStory.mutate(file, { onError: () => toast(t('uploadFailed')) });
  };

  const avatar = (
    <UserAvatar
      src={me.avatarUrl}
      alt={me.username}
      size={74}
      ring={myTray ? (myTray.hasUnseen ? 'unseen' : 'seen') : 'none'}
      ringWidth="thick"
    />
  );

  return (
    <div className="flex w-22.5 shrink-0 flex-col items-center">
      <span className="relative">
        {myTray ? (
          <Link href={`/stories/${me.username}`} draggable={false} aria-label={t('yourStory')}>
            {avatar}
          </Link>
        ) : (
          // Same size as a ringed avatar, so the row stays aligned
          <button type="button" onClick={pickFile} aria-label={t('addStory')} className="p-1.5">
            {avatar}
          </button>
        )}
        <button
          type="button"
          onClick={pickFile}
          disabled={createStory.isPending}
          aria-label={t('addStory')}
          className="absolute right-0.5 bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-background bg-brand text-brand-foreground"
        >
          {createStory.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3.5" strokeWidth={3} />
          )}
        </button>
      </span>
      <span className="w-full truncate text-center text-xs text-muted-foreground">
        {t('yourStory')}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
