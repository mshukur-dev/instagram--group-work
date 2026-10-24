'use client';

import { Share, SquarePlus } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { setIosSheetOpen, useIosSheetOpen } from '../install';

const closeSheet = () => setIosSheetOpen(false);
const noop = () => () => undefined;

/** Mounted once in Providers; the More menu's "Install app" opens it on iPhone. */
export function IosInstallSheetHost() {
  const open = useIosSheetOpen();
  return <IosInstallSheet open={open} onClose={closeSheet} />;
}

// iPhone Safari can't install a site from a button, so "Install app" opens this sheet with the
// three steps through Safari's Share menu (docs/spec/pwa.md). Pulled down, tapped outside or
// closed with Escape, it slides away.
export function IosInstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('pwa');
  const reduceMotion = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  // The portal needs document.body: nothing on the server and during hydration
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.y > 70 || info.velocity.y > 500) onClose();
  };

  const inline = {
    b: (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>,
  };
  const steps = [
    t.rich('iosStep1', {
      ...inline,
      icon: () => (
        <Share aria-hidden="true" className="mx-0.5 inline size-4.5 -translate-y-px text-brand" />
      ),
    }),
    t.rich('iosStep2', {
      ...inline,
      icon: () => (
        <SquarePlus aria-hidden="true" className="mx-0.5 inline size-4.5 -translate-y-px" />
      ),
    }),
    t('iosStep3'),
  ];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-90" role="presentation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 440, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[28px] border-t border-foreground/10 bg-card/90 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),16px)] shadow-float-raised outline-none backdrop-blur-2xl"
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-5 block h-1 w-10 rounded-full bg-foreground/20"
            />

            {/* The icon that will land on the Home Screen */}
            <motion.img
              src="/icons/icon-192.png"
              alt=""
              width={72}
              height={72}
              initial={reduceMotion ? false : { scale: 0.6, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
              className="mx-auto size-18 rounded-[22%] shadow-float-raised"
            />
            <h2
              id="ios-install-title"
              className="mt-4 text-center text-lg font-semibold text-balance"
            >
              {t('iosTitle')}
            </h2>
            <p className="mx-auto mt-1 max-w-xs text-center text-sm text-balance text-muted-foreground">
              {t('iosSubtitle')}
            </p>

            <ol className="mt-5 space-y-1 rounded-2xl bg-foreground/5 p-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[15px]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-semibold text-background">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 h-12 w-full rounded-xl bg-brand text-[15px] font-semibold text-brand-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-brand-hover active:opacity-80"
            >
              {t('gotIt')}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
