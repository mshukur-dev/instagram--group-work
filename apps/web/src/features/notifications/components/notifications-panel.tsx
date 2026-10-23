'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { NotificationsContent } from './notifications-content';

// Desktop: notifications slide out on top of the sidebar (docs/spec/frontend.md, section 6).
// Closes with the X, on Escape, a click outside, or moving to another page. The sidebar's Heart
// button is marked with data-notifications-toggle, so clicking it only toggles.
export function NotificationsPanel() {
  const open = useUiStore((state) => state.notificationsOpen);
  const close = useUiStore((state) => state.closeNotifications);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => close(), [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      // Clicks inside dialogs opened from a row (unfollow, post) don't close the panel
      if (
        panelRef.current?.contains(target) ||
        target.closest('[data-notifications-toggle], [role="dialog"]')
      )
        return;
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-y-5 left-5 z-30 w-100 overflow-hidden rounded-[32px] border border-border/60 bg-background shadow-float-raised max-md:hidden"
        >
          <NotificationsContent onNavigate={close} onClose={close} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
