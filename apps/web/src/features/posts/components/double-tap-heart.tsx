'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

export type TapHeart = {
  id: number;
  x: number;
  y: number;
  /** Degrees; each heart lands a little tilted */
  tilt: number;
  /** Now and then the heart comes in the Instagram gradient instead of white */
  gradient: boolean;
};

// About one heart in four is the gradient one, like the original's occasional surprise
const GRADIENT_CHANCE = 0.25;

export const makeTapHeart = (id: number, x: number, y: number): TapHeart => ({
  id,
  x,
  y,
  tilt: Math.round((Math.random() - 0.5) * 36),
  gradient: Math.random() < GRADIENT_CHANCE,
});

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

// The heart of a double tap on a post: it pops in tilted with a little bounce, holds for a
// beat, then floats up and fades. Removed by the parent when its animation is done.
export function DoubleTapHeart({ heart, onDone }: { heart: TapHeart; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const gradientId = `tap-heart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paint = heart.gradient ? `url(#${gradientId})` : 'white';

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
      <svg
        viewBox="0 0 24 24"
        className={
          heart.gradient
            ? 'size-full drop-shadow-[0_6px_22px_color-mix(in_oklab,var(--story-ring-3)_45%,transparent)]'
            : 'size-full drop-shadow-[0_6px_18px_rgb(0_0_0/0.35)]'
        }
      >
        {heart.gradient && (
          <defs>
            {/* The Instagram glow: yellow at the bottom left to violet at the top right */}
            <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--story-ring-1)" />
              <stop offset="28%" stopColor="var(--story-ring-2)" />
              <stop offset="55%" stopColor="var(--story-ring-3)" />
              <stop offset="80%" stopColor="var(--story-ring-4)" />
              <stop offset="100%" stopColor="var(--story-ring-5)" />
            </linearGradient>
          </defs>
        )}
        <path d={HEART_PATH} fill={paint} stroke={paint} strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </motion.span>
  );
}
