'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

// Frame for an in-app card shown with Sonner's toast.custom(): the card is the whole toast, so
// the pill frame every other toast gets (toaster.tsx) is dropped
export const TOAST_CARD_FRAME =
  'rounded-none! border-0! bg-transparent! p-0! shadow-none! backdrop-blur-none! backdrop-saturate-100! w-auto! max-w-none!';

type Props = {
  avatarUrl: string | null;
  /** Small round sign on the avatar: what kind of news this is */
  badge: React.ReactNode;
  badgeClassName: string;
  title: string;
  text: string;
  /** A picture on the right (the liked post) */
  thumbnail?: string | null;
  onOpen: () => void;
  onClose: () => void;
};

/**
 * A frosted card with who and what (a new message, a like, a follow…). A tap opens it, the cross
 * closes it; on a phone it drops from the top and is swiped up (toaster.tsx).
 */
export function ToastCard({
  avatarUrl,
  badge,
  badgeClassName,
  title,
  text,
  thumbnail,
  onOpen,
  onClose,
}: Props) {
  const t = useTranslations('direct.toast');
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <div className="group/card relative w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[20px] bg-popover/90 text-popover-foreground shadow-float-raised ring-1 ring-foreground/8 backdrop-blur-2xl backdrop-saturate-150">
      {/* Not a <button>: Sonner starts a swipe only on elements that aren't buttons, and this
          is the whole card. A swipe that ends on it must not count as a tap. */}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(event) => {
          down.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={(event) => {
          const start = down.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
          onOpen();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          'flex w-full cursor-pointer items-start gap-3 p-3.5 text-left outline-none focus-visible:bg-foreground/4',
          thumbnail ? 'pr-3.5' : 'pr-10',
        )}
      >
        <span className="relative shrink-0">
          <UserAvatar src={avatarUrl} alt="" size={44} />
          <span
            className={cn(
              'absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-popover',
              badgeClassName,
            )}
          >
            {badge}
          </span>
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{t('now')}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-foreground/80">
            {text}
          </span>
        </span>
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            draggable={false}
            className="size-11 shrink-0 rounded-md object-cover"
          />
        )}
      </div>
      {!thumbnail && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 outline-none transition-[opacity,background-color] group-hover/card:opacity-100 hover:bg-foreground/8 focus-visible:opacity-100 max-md:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
