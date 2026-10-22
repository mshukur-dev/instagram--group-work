'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type Props = {
  count: number;
  /** Text for screen readers, e.g. "3 unread" */
  label: string;
};

// Red counter on a nav icon: pops in when the first unread item arrives, disappears when read
export function NavBadge({ count, label }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key="badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 26 }
          }
          className="bg-destructive ring-background absolute -top-1.5 -right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] leading-none font-semibold text-white ring-2"
        >
          <span aria-hidden="true">{count > 9 ? '9+' : count}</span>
          <span className="sr-only">{label}</span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
