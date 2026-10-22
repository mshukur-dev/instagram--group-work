'use client';

import type { Post } from '@instagram/shared';
import {
  Ellipsis,
  Link2,
  MessageCircle,
  MessageCircleOff,
  Pencil,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslations } from 'next-intl';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { useDeletePost, useUpdatePost } from '../queries';
import { EditCaptionDialog } from './edit-caption-dialog';
import { iconButtonBase } from './icon-button';
import { PostLink } from './post-link';

type Props = {
  post: Post;
  /** Show "Go to post" (the feed card; inside the post itself it makes no sense) */
  showGoTo?: boolean;
  /** Called after my post was deleted (the modal / page leaves) */
  onDeleted?: () => void;
};

// The panel springs out of the "…" button (scale from its corner) and settles without wobble;
// the rows fade in together with it (a tiny stagger only), so the text is readable at once.
// Frosted glass: the page shows through, blurred.
const panel: Variants = {
  closed: { opacity: 0, scale: 0.86, y: -6 },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 620,
      damping: 34,
      mass: 0.7,
      staggerChildren: 0.012,
    },
  },
  exit: { opacity: 0, scale: 0.94, y: -4, transition: { duration: 0.14, ease: 'easeIn' } },
};
const rowIn: Variants = {
  closed: { opacity: 0, y: -3 },
  open: { opacity: 1, y: 0, transition: { duration: 0.12, ease: 'easeOut' } },
};
const still: Variants = { closed: { opacity: 0 }, open: { opacity: 1 }, exit: { opacity: 0 } };

const row =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors select-none data-[highlighted]:bg-foreground/[0.07]';

// POST-5, POST-7: mine — edit caption, comments on/off, delete; anyone's — go to post, copy link
export function PostMenu({ post, showGoTo, onDeleted }: Props) {
  const t = useTranslations('post');
  const reduceMotion = useReducedMotion();
  const { data: me } = useMe();
  const update = useUpdatePost(post.id);
  const remove = useDeletePost(post.id);
  const [open, setOpen] = useState(false);
  // Dialogs opened from the menu; they are created only when picked
  const [step, setStep] = useState<'confirm' | 'edit' | null>(null);
  const mine = me?.id === post.author.id;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${post.id}`);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  // A menu left open would float over the page (and the phone's top bar) while it scrolls:
  // it closes as soon as anything scrolls, like a native menu
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  const item = (children: React.ReactNode) => (
    <motion.div variants={reduceMotion ? still : rowIn}>{children}</motion.div>
  );

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={t('more')}
            className={cn(iconButtonBase, 'data-[state=open]:bg-foreground/[0.07]')}
          >
            <Ellipsis className="size-5" />
          </button>
        </DropdownMenu.Trigger>

        <AnimatePresence>
          {open && (
            <DropdownMenu.Portal forceMount>
              <DropdownMenu.Content
                asChild
                forceMount
                align="end"
                sideOffset={6}
                collisionPadding={12}
                // Above the post modal and its dimmed page
                className="z-[80]"
              >
                <motion.div
                  variants={reduceMotion ? still : panel}
                  initial="closed"
                  animate="open"
                  exit="exit"
                  style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                  className="min-w-[230px] rounded-2xl border border-foreground/10 bg-card/75 p-1.5 text-card-foreground shadow-float-raised backdrop-blur-xl backdrop-saturate-150 outline-none"
                >
                  {mine && (
                    <>
                      {item(
                        <DropdownMenu.Item className={row} onSelect={() => setStep('edit')}>
                          <Pencil className="size-[18px]" />
                          {t('editCaption')}
                        </DropdownMenu.Item>,
                      )}
                      {item(
                        <DropdownMenu.Item
                          className={row}
                          onSelect={() =>
                            update.mutate({ commentsDisabled: !post.commentsDisabled })
                          }
                        >
                          {post.commentsDisabled ? (
                            <MessageCircle className="size-[18px] -scale-x-100" />
                          ) : (
                            <MessageCircleOff className="size-[18px]" />
                          )}
                          {t(post.commentsDisabled ? 'turnOnComments' : 'turnOffComments')}
                        </DropdownMenu.Item>,
                      )}
                    </>
                  )}
                  {showGoTo &&
                    item(
                      <DropdownMenu.Item asChild className={row}>
                        <PostLink postId={post.id}>
                          <SquareArrowOutUpRight className="size-[18px]" />
                          {t('goToPost')}
                        </PostLink>
                      </DropdownMenu.Item>,
                    )}
                  {item(
                    <DropdownMenu.Item className={row} onSelect={() => void copyLink()}>
                      <Link2 className="size-[18px] -rotate-45" />
                      {t('copyLink')}
                    </DropdownMenu.Item>,
                  )}
                  {mine && (
                    <>
                      <DropdownMenu.Separator className="mx-2 my-1 h-px bg-foreground/10" />
                      {item(
                        <DropdownMenu.Item
                          className={cn(row, 'font-semibold text-destructive')}
                          onSelect={() => setStep('confirm')}
                        >
                          <Trash2 className="size-[18px]" />
                          {t('delete')}
                        </DropdownMenu.Item>,
                      )}
                    </>
                  )}
                </motion.div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          )}
        </AnimatePresence>
      </DropdownMenu.Root>

      {step === 'confirm' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setStep(null)}
          title={t('deleteTitle')}
          description={t('deleteBody')}
          confirmLabel={t('delete')}
          cancelLabel={t('cancel')}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => onDeleted?.() })}
        />
      )}

      {step === 'edit' && (
        <EditCaptionDialog
          post={post}
          open
          onOpenChange={(next) => {
            if (!next) setStep(null);
          }}
        />
      )}
    </>
  );
}
