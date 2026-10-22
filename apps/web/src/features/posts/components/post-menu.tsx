'use client';

import type { Post } from '@instagram/shared';
import { Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog, ProfileDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { useDeletePost, useUpdatePost } from '../queries';
import { EditCaptionDialog } from './edit-caption-dialog';
import { iconButtonBase } from './icon-button';
import { PostLink } from './post-link';

const row =
  'block w-full border-t border-border/50 py-3.5 text-center text-sm outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06]';

type Props = {
  post: Post;
  /** Show "Go to post" (the feed card; inside the post itself it makes no sense) */
  showGoTo?: boolean;
  /** Called after my post was deleted (the modal / page leaves) */
  onDeleted?: () => void;
};

// The "…" of a post. Mine: delete, edit, turn comments off (POST-5, POST-7). Anyone's: copy link.
export function PostMenu({ post, showGoTo, onDeleted }: Props) {
  const t = useTranslations('post');
  const { data: me } = useMe();
  const update = useUpdatePost(post.id);
  const remove = useDeletePost(post.id);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'edit' | null>(null);
  const mine = me?.id === post.author.id;

  const finish = () => {
    setStep(null);
    setOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${post.id}`);
      toast(t('linkCopied'));
    } catch {
      toast(t('copyFailed'));
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={t('more')}
        onClick={() => setOpen(true)}
        className={iconButtonBase}
      >
        <Ellipsis className="size-5" />
      </button>

      <ProfileDialog
        open={open && step === null}
        onOpenChange={setOpen}
        title={t('more')}
        stacked
        className="max-w-[400px]"
      >
        <div className="flex flex-col">
          {mine && (
            <>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className={cn(row, 'border-t-0 font-bold text-destructive')}
              >
                {t('delete')}
              </button>
              <button type="button" onClick={() => setStep('edit')} className={row}>
                {t('editCaption')}
              </button>
              <button
                type="button"
                onClick={() => {
                  update.mutate({ commentsDisabled: !post.commentsDisabled });
                  setOpen(false);
                }}
                className={row}
              >
                {t(post.commentsDisabled ? 'turnOnComments' : 'turnOffComments')}
              </button>
            </>
          )}
          {showGoTo && (
            <PostLink postId={post.id} onClick={() => setOpen(false)} className={row}>
              {t('goToPost')}
            </PostLink>
          )}
          <button
            type="button"
            onClick={() => void copyLink()}
            className={cn(row, !mine && !showGoTo && 'border-t-0')}
          >
            {t('copyLink')}
          </button>
          <button type="button" autoFocus onClick={() => setOpen(false)} className={row}>
            {t('cancel')}
          </button>
        </div>
      </ProfileDialog>

      <ConfirmDialog
        open={open && step === 'confirm'}
        onOpenChange={(next) => !next && finish()}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => onDeleted?.() })}
      />

      {step === 'edit' && (
        <EditCaptionDialog
          post={post}
          open
          onOpenChange={(next) => {
            if (!next) finish();
          }}
        />
      )}
    </>
  );
}
