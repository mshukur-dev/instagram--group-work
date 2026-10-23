'use client';

import { Bell, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useIsClient } from '@/lib/use-is-client';
import { pushSupported } from '../push';
import { useEnablePush } from '../queries';

const DISMISS_KEY = 'push-prompt-dismissed-at';
// "Not now" hides the offer for this long
const DISMISS_FOR_MS = 3 * 24 * 60 * 60 * 1000;

const dismissedRecently = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
};

// PUSH-1: not a browser popup at login, but an offer where it makes sense, in the inbox:
// a click on "Turn on" asks the browser, and only then.
export function PushPrompt() {
  const t = useTranslations('push');
  const isClient = useIsClient();
  const enable = useEnablePush();
  const [hidden, setHidden] = useState(dismissedRecently);

  const show = isClient && !hidden && pushSupported() && Notification.permission === 'default';

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode: it just comes back next time
    }
  };

  const turnOn = () =>
    enable.mutate(undefined, {
      onSuccess: (on) => {
        setHidden(true);
        if (on) toast.success(t('enabled'));
        else toast.error(t('blocked'));
      },
      onError: () => toast.error(t('failed')),
    });

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="shrink-0 overflow-hidden"
        >
          <div className="mx-4 mb-2 flex items-start gap-3 rounded-2xl bg-secondary p-3 max-md:mx-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-story-ring text-white">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('title')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('text')}</p>
              <button
                type="button"
                onClick={turnOn}
                disabled={enable.isPending}
                className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand outline-none transition-colors hover:text-brand-hover focus-visible:underline disabled:opacity-60"
              >
                {enable.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {t('turnOn')}
              </button>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('notNow')}
              title={t('notNow')}
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
