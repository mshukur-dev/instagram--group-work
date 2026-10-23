'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cldUrl } from '@/lib/cloudinary';

// A live video takes the whole window: a tall column (9:16 on a computer, the full screen on a
// phone) where the camera and everything over it sit. Around it, the host's own photo, blown up
// and blurred, tints the room in their colors over a faint glow of the live colors. One still
// image, no animation: cheap to draw.
export function LiveFrame({
  children,
  backdrop,
}: {
  children: ReactNode;
  /** The host's avatar, for the ambient backdrop */
  backdrop?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black text-white">
      {backdrop && (
        <img
          src={cldUrl(backdrop, 'c_fill,w_160,h_160,f_auto,q_auto')}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full scale-125 object-cover opacity-55 blur-[90px] saturate-150"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_110%,color-mix(in_oklab,var(--like)_45%,transparent),transparent_70%),radial-gradient(45%_40%_at_10%_0%,color-mix(in_oklab,var(--story-ring-4)_38%,transparent),transparent_70%)]"
      />
      {/* Keeps the backdrop a backdrop: darker toward the edges */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.1),rgb(0_0_0/0.55))]"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-9/16 h-[min(100dvh-2rem,900px)] max-w-full overflow-hidden rounded-2xl bg-neutral-950 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10 max-md:aspect-auto max-md:h-dvh max-md:w-full max-md:rounded-none max-md:ring-0"
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
