'use client';

import { CircleAlert } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ProgressRing } from './progress-ring';

type Props = {
  status: 'publishing' | 'done' | 'error';
  progress: number;
  errorText: string;
  onRetry: () => void;
  onBack: () => void;
  onDone: () => void;
};

const buttonClass =
  'h-9 rounded-lg px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function PublishStep({ status, progress, errorText, onRetry, onBack, onDone }: Props) {
  const t = useTranslations('createPost');
  const reduceMotion = useReducedMotion();
  const rise = reduceMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="flex size-full flex-col items-center justify-center gap-7 px-8 text-center">
      {status === 'error' ? (
        <>
          <span className="bg-destructive/10 text-destructive grid size-24 place-items-center rounded-full">
            <CircleAlert className="size-10" strokeWidth={1.5} />
          </span>
          <div className="flex max-w-xs flex-col gap-1.5">
            <p className="text-xl font-light">{t('failedTitle')}</p>
            <p role="alert" className="text-muted-foreground text-sm">
              {errorText}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className={`${buttonClass} bg-secondary text-secondary-foreground hover:bg-secondary/70`}
            >
              {t('backToEditing')}
            </button>
            <button
              type="button"
              onClick={onRetry}
              className={`${buttonClass} bg-brand text-brand-foreground hover:bg-brand-hover`}
            >
              {t('retry')}
            </button>
          </div>
        </>
      ) : (
        <>
          <ProgressRing progress={progress} done={status === 'done'} />
          <div className="flex flex-col items-center gap-1.5" aria-live="polite">
            <motion.p
              key={status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={rise}
              className="text-xl font-light"
            >
              {t(status === 'done' ? 'sharedTitle' : 'sharingTitle')}
            </motion.p>
            {status === 'publishing' && (
              <p className="text-muted-foreground text-sm">{t('sharingHint')}</p>
            )}
          </div>
          {status === 'done' && (
            <motion.button
              type="button"
              onClick={onDone}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...rise, delay: reduceMotion ? 0 : 0.35 }}
              className={`${buttonClass} bg-brand text-brand-foreground hover:bg-brand-hover`}
            >
              {t('done')}
            </motion.button>
          )}
        </>
      )}
    </div>
  );
}
