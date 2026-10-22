'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const variants = {
  enter: (direction: number) => ({ y: direction * 10, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({ y: direction * -10, opacity: 0 }),
};

// "12 likes": when the number changes the old text slides out and the new one slides in,
// upwards for a new like and downwards when a like is taken back.
export function LikesCount({ count }: { count: number }) {
  const t = useTranslations('post');
  const reduceMotion = useReducedMotion();
  const [previous, setPrevious] = useState(count);
  const [direction, setDirection] = useState(1);

  // Adjusting state while rendering is the documented way to react to a changed prop
  if (count !== previous) {
    setDirection(count > previous ? 1 : -1);
    setPrevious(count);
  }

  if (count <= 0) return null;

  return (
    <div className="relative h-5 overflow-hidden text-sm leading-5 font-semibold">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.p
          key={count}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {t('likes', { count })}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
