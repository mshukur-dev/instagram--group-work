'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

// A live video takes the whole window: a black room with a tall column (9:16 on a computer,
// the full screen on a phone) where the camera and everything over it sit.
export function LiveFrame({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black text-white">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-9/16 h-[min(100dvh-2rem,900px)] max-w-full overflow-hidden rounded-2xl bg-neutral-950 max-md:aspect-auto max-md:h-dvh max-md:w-full max-md:rounded-none"
      >
        {children}
      </motion.div>
    </div>
  );
}

/** A centered message inside the frame: ended, private, not found */
export function LiveNotice({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {body && <p className="max-w-64 text-sm text-white/70">{body}</p>}
      <div className="mt-5">{action}</div>
    </div>
  );
}

export const liveButton =
  'rounded-full px-6 py-2.5 text-sm font-semibold outline-none transition-[filter,background-color] focus-visible:ring-2 focus-visible:ring-white/70';
