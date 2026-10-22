'use client';

import { Heart } from 'lucide-react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Props = {
  liked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
};

// Small heart at the right of a comment. Same pop as the post's heart, without the burst.
export function CommentLike({ liked, disabled, onToggle }: Props) {
  const t = useTranslations('comments');
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  const toggle = () => {
    const next = !liked;
    onToggle(next);
    if (reduceMotion) return;
    void animate(
      scope.current,
      { scale: next ? [1, 1.45, 0.9, 1] : [1, 0.8, 1] },
      { duration: next ? 0.45 : 0.22, ease: 'easeOut' },
    );
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={toggle}
      aria-pressed={liked}
      aria-label={t(liked ? 'unlike' : 'like')}
      className="-m-1.5 mt-0.5 grid size-8 shrink-0 place-items-center self-start rounded-full outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-90 disabled:opacity-40"
    >
      <span ref={scope} className="grid">
        <Heart
          className={cn(
            'size-3.5 transition-[fill,color] duration-200',
            liked ? 'fill-destructive text-destructive' : 'text-muted-foreground',
          )}
        />
      </span>
    </button>
  );
}
