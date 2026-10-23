'use client';

import { motion, useReducedMotion } from 'motion/react';

type Props = {
  /** 0..1 */
  progress: number;
  done: boolean;
};

const R = 52;

// The memorable moment of the flow: a story-ring that fills while the post uploads
// and turns into a drawn checkmark when it is shared.
export function ProgressRing({ progress, done }: Props) {
  const reduceMotion = useReducedMotion();
  const fill = reduceMotion
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 70, damping: 20, mass: 0.8 } as const);

  return (
    <motion.div
      animate={done && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative size-36"
    >
      <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="story-ring-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--story-ring-1)' }} />
            <stop offset="30%" style={{ stopColor: 'var(--story-ring-2)' }} />
            <stop offset="55%" style={{ stopColor: 'var(--story-ring-3)' }} />
            <stop offset="80%" style={{ stopColor: 'var(--story-ring-4)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--story-ring-5)' }} />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} fill="none" strokeWidth="6" className="stroke-border" />
        <motion.circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="url(#story-ring-gradient)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(progress, 0.02) }}
          transition={fill}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        {done ? (
          <svg viewBox="0 0 64 64" className="size-14" aria-hidden="true">
            <motion.path
              d="M16 33 L28 45 L49 21"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-foreground"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: reduceMotion ? 0 : 0.45,
                delay: reduceMotion ? 0 : 0.2,
                ease: 'easeOut',
              }}
            />
          </svg>
        ) : (
          <span className="text-3xl font-light tabular-nums" aria-hidden="true">
            {Math.round(progress * 100)}
            <span className="text-muted-foreground text-base">%</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}
