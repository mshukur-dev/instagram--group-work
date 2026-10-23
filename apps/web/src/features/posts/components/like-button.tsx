'use client';

import { Heart } from 'lucide-react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { iconButtonBase } from './icon-button';

const PARTICLES = 8;

// Little dots that fly out of the heart, in the story-ring colors
function Burst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 -mt-0.5 -ml-0.5 size-1 rounded-full"
            style={{ backgroundColor: `var(--story-ring-${(i % 5) + 1})` }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: Math.cos(angle) * 21, y: Math.sin(angle) * 21, scale: 1, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        );
      })}
    </span>
  );
}

type Props = {
  liked: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
};

// The heart pops when it is liked (overshoot + a ring of dots) and dips when the like is taken back.
export function LikeButton({ liked, onToggle, className }: Props) {
  const t = useTranslations('post');
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const [burst, setBurst] = useState(0);

  const toggle = () => {
    const next = !liked;
    onToggle(next);
    if (reduceMotion) return;
    if (next) {
      void animate(
        scope.current,
        { scale: [1, 1.35, 0.92, 1] },
        { duration: 0.5, ease: 'easeOut' },
      );
      setBurst((count) => count + 1);
    } else {
      void animate(scope.current, { scale: [1, 0.8, 1] }, { duration: 0.25, ease: 'easeOut' });
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={t(liked ? 'unlike' : 'like')}
      className={cn(iconButtonBase, 'relative', className)}
    >
      <span ref={scope} className="grid">
        <Heart
          className={cn(
            'size-6 transition-[fill,color] duration-200',
            liked && 'fill-destructive text-destructive',
          )}
        />
      </span>
      {burst > 0 && <Burst key={burst} />}
    </button>
  );
}
