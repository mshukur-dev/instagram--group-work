'use client';

import { Dialog } from 'radix-ui';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog name for screen readers; the visible header is part of `children` */
  title: string;
  className?: string;
  /** A dialog opened on top of another one (confirmations) sits one layer higher */
  stacked?: boolean;
  children: React.ReactNode;
};

// Centered card over a dimmed page, same look as the create-post dialog.
// Opens and closes with a short fade and zoom (tw-animate-css on Radix data-state).
export function ProfileDialog({ open, onOpenChange, title, className, stacked, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
            stacked ? 'z-60' : 'z-40',
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed top-1/2 left-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl outline-none',
            'duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            stacked ? 'z-70' : 'z-50',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Avatar or other picture above the question */
  picture?: React.ReactNode;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

// "Unfollow @user?" / "Remove follower?": the red action on top, Cancel below
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  picture,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: ConfirmProps) {
  const rowClass =
    'w-full border-t border-border/50 py-3.5 text-sm outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6';

  return (
    <ProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      stacked
      className="max-w-100"
    >
      <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-6 text-center">
        {picture}
        <div className="space-y-1">
          {/* Already announced by Dialog.Title */}
          <p aria-hidden="true" className="text-[15px] font-semibold wrap-break-word">
            {title}
          </p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onConfirm();
          onOpenChange(false);
        }}
        className={cn(rowClass, 'font-bold text-destructive')}
      >
        {confirmLabel}
      </button>
      <button type="button" autoFocus onClick={() => onOpenChange(false)} className={rowClass}>
        {cancelLabel}
      </button>
    </ProfileDialog>
  );
}
