'use client';

import { CAPTION_MAX, type Post } from '@instagram/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { ProfileDialog } from '@/features/profile/components/profile-dialog';
import { cn } from '@/lib/utils';
import { useUpdatePost } from '../queries';

type Props = {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// POST-5: change the caption of my post. Hashtags and mentions are re-read by the server.
export function EditCaptionDialog({ post, open, onOpenChange }: Props) {
  const t = useTranslations('post');
  const update = useUpdatePost(post.id);
  const [text, setText] = useState(post.caption ?? '');
  const changed = text.trim() !== (post.caption ?? '');
  const tooLong = text.length > CAPTION_MAX;

  const save = () => {
    if (!changed || tooLong) return;
    update.mutate({ caption: text.trim() || null });
    onOpenChange(false);
  };

  return (
    <ProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('editCaption')}
      stacked
      className="max-w-130"
    >
      <header className="grid h-11 grid-cols-[5rem_1fr_5rem] items-center border-b border-border/50 text-sm">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-full rounded-tl-2xl px-4 text-left outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6"
        >
          {t('cancel')}
        </button>
        <h2 aria-hidden="true" className="text-center text-[15px] font-semibold">
          {t('editCaption')}
        </h2>
        <button
          type="button"
          onClick={save}
          disabled={!changed || tooLong}
          className="h-full rounded-tr-2xl px-4 text-right font-semibold text-brand outline-none transition-[opacity,background-color] hover:bg-foreground/4 focus-visible:bg-foreground/6 disabled:opacity-40"
        >
          {t('done')}
        </button>
      </header>
      <div className="flex gap-3 p-4">
        <UserAvatar src={post.author.avatarUrl} alt={post.author.username} size={32} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">{post.author.username}</p>
          <textarea
            autoFocus
            value={text}
            rows={6}
            onChange={(event) => setText(event.target.value)}
            onFocus={(event) => event.currentTarget.setSelectionRange(text.length, text.length)}
            placeholder={t('captionPlaceholder')}
            aria-label={t('editCaption')}
            className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground"
          />
          <p
            className={cn(
              'text-right text-xs tabular-nums',
              tooLong ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {text.length}/{CAPTION_MAX}
          </p>
        </div>
      </div>
    </ProfileDialog>
  );
}
