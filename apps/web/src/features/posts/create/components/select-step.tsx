'use client';

import { Images, Play } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { ACCEPT } from '../draft';

type Props = {
  dragging: boolean;
  onFiles: (files: File[]) => void;
};

const spring = { type: 'spring', stiffness: 260, damping: 18 } as const;

// First screen: the two stacked tiles spread apart when files are dragged over the window.
export function SelectStep({ dragging, onFiles }: Props) {
  const t = useTranslations('createPost');
  const input = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : spring;

  return (
    <div className="relative flex size-full flex-col items-center justify-center gap-6 px-8 text-center">
      {/* Story-ring outline, only while dragging */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: dragging ? 1 : 0, scale: dragging ? 1 : 0.97 }}
        transition={{ duration: reduceMotion ? 0 : 0.25 }}
        className="bg-story-ring pointer-events-none absolute inset-4 rounded-3xl p-0.5"
      >
        <div className="bg-card size-full rounded-[calc(1.5rem-2px)]" />
      </motion.div>

      <div className="relative h-24 w-32">
        <motion.span
          initial={false}
          animate={{ x: dragging ? -34 : -14, rotate: dragging ? -14 : -8, y: dragging ? -4 : 0 }}
          transition={transition}
          className="bg-secondary text-foreground/80 border-border absolute top-2 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-2xl border shadow-sm"
        >
          <Images className="size-7" strokeWidth={1.5} />
        </motion.span>
        <motion.span
          initial={false}
          animate={{ x: dragging ? 34 : 14, rotate: dragging ? 14 : 8, y: dragging ? 6 : 10 }}
          transition={transition}
          className="bg-card text-foreground border-border absolute top-2 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-2xl border shadow-md"
        >
          <Play className="size-7 fill-current" strokeWidth={1.5} />
        </motion.span>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <p className="text-xl font-light">{t(dragging ? 'dropTitle' : 'dragTitle')}</p>
        <p className="text-muted-foreground text-sm">{t('limitsHint')}</p>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          'bg-brand text-brand-foreground hover:bg-brand-hover relative h-9 rounded-lg px-4 text-sm font-semibold transition-colors',
          'focus-visible:ring-ring/60 outline-none focus-visible:ring-2',
        )}
      >
        {t('selectFromComputer')}
      </button>

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}
