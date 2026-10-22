'use client';

import { Bookmark } from 'lucide-react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Props = {
  saved: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
};

// The bookmark fills with a short "drop in" bounce when it is saved
export function SaveButton({ saved, onToggle, className }: Props) {
  const t = useTranslations('post');
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  const toggle = () => {
    const next = !saved;
    onToggle(next);
    if (reduceMotion) return;
    if (next) {
      void animate(
        scope.current,
        { scale: [1, 0.78, 1.14, 1], y: [0, 2, -2, 0] },
        { duration: 0.42, ease: 'easeOut' },
      );
    } else {
      void animate(scope.current, { scale: [1, 0.88, 1] }, { duration: 0.22, ease: 'easeOut' });
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={t(saved ? 'unsave' : 'save')}
      className={cn(
        'grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        'transition-opacity hover:opacity-60 active:opacity-60',
        className,
      )}
    >
      <span ref={scope} className="grid">
        <Bookmark
          className={cn('size-6 transition-[fill] duration-200', saved && 'fill-foreground')}
        />
      </span>
    </button>
  );
}
