'use client';

import { HIGHLIGHT_TITLE_MAX, type Story } from '@instagram/shared';
import { Check, ChevronLeft, History, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { toast } from 'sonner';
import { useCreateHighlight, useStoryArchive } from '@/features/settings/queries';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { ProfileDialog } from './profile-dialog';

const picture = (story: Story) =>
  story.thumbnailUrl ?? (story.mediaType === 'VIDEO' ? videoPoster(story.url) : story.url);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// STORY-8: the "New" circle on my profile opens this, like Instagram on the web: first a name,
// then "Next" shows my story archive to pick from, "Done" saves the highlight on the profile.
export function NewHighlightDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('profile.highlights');
  const [step, setStep] = useState<'name' | 'stories'>('name');
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const create = useCreateHighlight();

  const close = (next: boolean) => {
    if (!next) {
      setStep('name');
      setTitle('');
      setPicked([]);
    }
    onOpenChange(next);
  };

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const save = () =>
    create.mutate(
      { title: title.trim(), storyIds: picked },
      {
        onSuccess: () => {
          toast.success(t('created'));
          close(false);
        },
        onError: () => toast.error(t('createFailed')),
      },
    );

  return (
    <ProfileDialog open={open} onOpenChange={close} title={t('newTitle')} className="max-w-100">
      <div className="relative flex h-11 items-center justify-center border-b border-border">
        {step === 'stories' && (
          <button
            type="button"
            onClick={() => setStep('name')}
            aria-label={t('back')}
            className="absolute left-2 grid size-8 place-items-center rounded-full outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <p aria-hidden="true" className="font-semibold">
          {step === 'name' ? t('newTitle') : t('stories')}
        </p>
        <button
          type="button"
          onClick={() => close(false)}
          aria-label={t('close')}
          className="absolute right-2 grid size-8 place-items-center rounded-full outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      </div>

      {step === 'name' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) setStep('stories');
          }}
          className="flex flex-col"
        >
          <div className="px-4 py-6">
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={HIGHLIGHT_TITLE_MAX}
              placeholder={t('namePlaceholder')}
              aria-label={t('namePlaceholder')}
              className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <button
            type="submit"
            disabled={!title.trim()}
            className="border-t border-border py-3.5 text-sm font-semibold text-brand outline-none transition-colors hover:bg-foreground/4 disabled:text-brand/40 disabled:hover:bg-transparent"
          >
            {t('next')}
          </button>
        </form>
      ) : (
        <>
          <ArchivePicker picked={picked} onToggle={toggle} />
          <button
            type="button"
            disabled={picked.length === 0 || create.isPending}
            onClick={save}
            className="flex w-full items-center justify-center gap-2 border-t border-border py-3.5 text-sm font-semibold text-brand outline-none transition-colors hover:bg-foreground/4 disabled:text-brand/40 disabled:hover:bg-transparent"
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('done')}
          </button>
        </>
      )}
    </ProfileDialog>
  );
}

// My archive in a scrolling 3-column grid; a tap marks a story with the blue check
function ArchivePicker({ picked, onToggle }: { picked: string[]; onToggle: (id: string) => void }) {
  const t = useTranslations('profile.highlights');
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useStoryArchive();
  const { ref, inView } = useInView({ rootMargin: '200px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const stories = data?.pages.flatMap((page) => page.items) ?? [];

  if (isPending) {
    return (
      <div className="grid h-80 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="grid size-16 place-items-center rounded-full border-2 border-foreground">
          <History className="size-8" strokeWidth={1.5} />
        </span>
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-3 gap-0.5">
        {stories.map((story) => {
          const image = picture(story);
          const selected = picked.includes(story.id);
          return (
            <button
              key={story.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(story.id)}
              className="relative aspect-9/16 overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              {image && (
                <img
                  src={cldUrl(image, 'c_fill,w_200,h_356,f_auto,q_auto')}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={cn('size-full object-cover', selected && 'opacity-80')}
                />
              )}
              <span
                className={cn(
                  'absolute right-2 bottom-2 grid size-5 place-items-center rounded-full border-2 border-white',
                  selected && 'border-brand bg-brand',
                )}
              >
                {selected && <Check className="size-3 text-white" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <div ref={ref} />
    </div>
  );
}
