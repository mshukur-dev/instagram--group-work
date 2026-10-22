'use client';

import { motion, useReducedMotion } from 'motion/react';

const R = 68;
const START = -50; // degrees: puts the gap of the ring at the top
const FILLED = 0.8; // the ring stops at 80%

// The one memorable thing on the 404 page: a story ring that draws itself and never closes.
// A small dot waits in the gap, where the missing piece should be.
export function NotFoundRing({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  // Center of the gap on the circle (angle measured clockwise from 3 o'clock)
  const gapAngle = ((START + 360 * (FILLED + (1 - FILLED) / 2)) * Math.PI) / 180;
  const dotX = 80 + R * Math.cos(gapAngle);
  const dotY = 80 + R * Math.sin(gapAngle);

  return (
    <div className="relative size-44 max-md:size-36" role="img" aria-label={label}>
      <svg viewBox="0 0 160 160" className="size-full" aria-hidden="true">
        <defs>
          <linearGradient id="not-found-ring" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--story-ring-1)' }} />
            <stop offset="30%" style={{ stopColor: 'var(--story-ring-2)' }} />
            <stop offset="55%" style={{ stopColor: 'var(--story-ring-3)' }} />
            <stop offset="80%" style={{ stopColor: 'var(--story-ring-4)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--story-ring-5)' }} />
          </linearGradient>
        </defs>
        <g transform={`rotate(${START} 80 80)`}>
          <circle cx="80" cy="80" r={R} fill="none" strokeWidth="7" className="stroke-border" />
          <motion.circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke="url(#not-found-ring)"
            initial={{ pathLength: reduceMotion ? FILLED : 0 }}
            animate={{ pathLength: FILLED }}
            transition={{ duration: reduceMotion ? 0 : 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </g>
        <motion.circle
          cx={dotX}
          cy={dotY}
          r="4.5"
          style={{ fill: 'var(--story-ring-5)' }}
          initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0 : 0.5,
            delay: reduceMotion ? 0 : 1.3,
            ease: 'easeOut',
          }}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center text-4xl font-light tracking-tight tabular-nums max-md:text-3xl"
      >
        404
      </span>
    </div>
  );
}
