'use client';

import { HIGHLIGHT_TITLE_MAX, type Story } from '@instagram/shared';
import { Check, History } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { toast } from 'sonner';
import { profileButton } from '@/features/profile/components/profile-button';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { useCreateHighlight, useStoryArchive } from '../queries';
import { SettingsLoading, SettingsPage } from './settings-ui';

const picture = (story: Story) =>
  story.thumbnailUrl ?? (story.mediaType === 'VIDEO' ? videoPoster(story.url) : story.url);

// SETTINGS-7: every story I posted, also the expired ones. "New highlight" switches to picking
// stories, then a name turns them into a Highlight on my profile.
export function ArchiveSettings() {
  const t = useTranslations('settings.archive');
  const format = useFormatter();
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useStoryArchive();
  const create = useCreateHighlight();
  const { ref, inView } = useInView({ rootMargin: '400px' });
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const stories = data?.pages.flatMap((page) => page.items) ?? [];

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const stopPicking = () => {
    setPicking(false);
    setPicked([]);
    setTitle('');
  };

  const save = () =>
    create.mutate(
      { title: title.trim(), storyIds: picked },
      {
        onSuccess: () => {
          toast.success(t('created'));
          stopPicking();
        },
        onError: () => toast.error(t('createFailed')),
      },
    );

  return (
    <SettingsPage title={t('title')} description={t('description')}>
      {isPending ? (
        <SettingsLoading />
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full border-2 border-foreground">
            <History className="size-8" strokeWidth={1.5} />
          </span>
          <p className="font-semibold">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={picking ? stopPicking : () => setPicking(true)}
              className={profileButton(picking ? 'secondary' : 'primary')}
            >
              {picking ? t('cancel') : t('newHighlight')}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {stories.map((story) => {
              const image = picture(story);
              const selected = picked.includes(story.id);
              const date = new Date(story.createdAt);
              return (
                <button
                  key={story.id}
                  type="button"
                  disabled={!picking}
                  aria-pressed={picking ? selected : undefined}
                  onClick={() => toggle(story.id)}
                  className="relative aspect-9/16 overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {image && (
                    <img
                      src={cldUrl(image, 'c_fill,w_300,h_533,f_auto,q_auto')}
                      alt=""
                      loading="lazy"
                      className={cn('size-full object-cover', picking && !selected && 'opacity-60')}
                    />
                  )}
                  {/* Light date card in the corner, like Instagram's archive */}
                  <span className="absolute top-2 left-2 rounded-md bg-background px-2 py-1 text-center leading-tight text-foreground">
                    <span className="block text-base font-bold">{date.getDate()}</span>
                    <span className="block text-[10px] uppercase">
                      {format.dateTime(date, { month: 'short' })}
                    </span>
                  </span>
                  {picking && (
                    <span
                      className={cn(
                        'absolute top-2 right-2 grid size-6 place-items-center rounded-full border-2 border-white',
                        selected && 'border-brand bg-brand',
                      )}
                    >
                      {selected && <Check className="size-4 text-white" strokeWidth={3} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div ref={ref} />
        </>
      )}

      {picking && picked.length > 0 && (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-float-raised max-md:bottom-16">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={HIGHLIGHT_TITLE_MAX}
            placeholder={t('namePlaceholder')}
            aria-label={t('namePlaceholder')}
            className="h-9 min-w-0 flex-1 rounded-lg bg-secondary px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <button
            type="button"
            disabled={!title.trim() || create.isPending}
            onClick={save}
            className={profileButton('primary')}
          >
            {t('create', { count: picked.length })}
          </button>
        </div>
      )}
    </SettingsPage>
  );
}
