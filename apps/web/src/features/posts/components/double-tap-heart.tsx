'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

// Two gradients, both from the app's own colors, picked at random for each heart:
// - classic: the Instagram glow, yellow at the bottom left to violet at the top right
// - love: the like red warming into magenta and the violet of Direct
const PALETTES = {
  classic: {
    stops: [
      [0, 'var(--story-ring-1)'],
      [28, 'var(--story-ring-2)'],
      [55, 'var(--story-ring-3)'],
      [80, 'var(--story-ring-4)'],
      [100, 'var(--story-ring-5)'],
    ],
    glow: 'drop-shadow-[0_6px_22px_color-mix(in_oklab,var(--story-ring-3)_45%,transparent)]',
  },
  love: {
    stops: [
      [0, 'var(--like)'],
      [50, 'var(--story-ring-3)'],
      [100, 'var(--dm-from)'],
    ],
    glow: 'drop-shadow-[0_6px_22px_color-mix(in_oklab,var(--like)_45%,transparent)]',
  },
} as const;
type Palette = keyof typeof PALETTES;

export type TapHeart = {
  id: number;
  x: number;
  y: number;
  /** Degrees; each heart lands a little tilted */
  tilt: number;
  palette: Palette;
};

export const makeTapHeart = (id: number, x: number, y: number): TapHeart => ({
  id,
  x,
  y,
  tilt: Math.round((Math.random() - 0.5) * 36),
  palette: Math.random() < 0.5 ? 'classic' : 'love',
});

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

// The heart of a double tap on a post: it pops in tilted with a little bounce, holds for a
// beat, then floats up and fades. Removed by the parent when its animation is done.
export function DoubleTapHeart({ heart, onDone }: { heart: TapHeart; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const gradientId = `tap-heart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const palette = PALETTES[heart.palette];

  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute z-10 -mt-14 -ml-14 size-28"
      style={{ left: heart.x, top: heart.y, rotate: heart.tilt }}
      initial={{ scale: 0, opacity: 0, y: 0 }}
      animate={
        reduceMotion
          ? { scale: 1, opacity: [0, 1, 1, 0] }
          : {
              scale: [0, 1.22, 0.9, 1.04, 1, 0.82],
              opacity: [0, 1, 1, 1, 1, 0],
              y: [0, 0, 0, 0, 0, -90],
            }
      }
      transition={{
        duration: reduceMotion ? 0.8 : 1.05,
        times: reduceMotion ? [0, 0.1, 0.8, 1] : [0, 0.16, 0.27, 0.36, 0.62, 1],
        ease: 'easeOut',
      }}
      onAnimationComplete={onDone}
    >
      <svg viewBox="0 0 24 24" className={`size-full ${palette.glow}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            {palette.stops.map(([offset, color]) => (
              <stop key={offset} offset={`${offset}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
        <path
          d={HEART_PATH}
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    </motion.span>
  );
}
