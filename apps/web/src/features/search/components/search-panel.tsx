'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { SearchContent } from './search-content';

// Desktop: search slides out next to the sidebar (docs/spec/frontend.md, section 6).
// Closes on Escape, a click outside, or moving to another page.
// The sidebar's Search button is marked with data-search-toggle, so clicking it only toggles.
export function SearchPanel() {
  const open = useUiStore((state) => state.searchOpen);
  const close = useUiStore((state) => state.closeSearch);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => close(), [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (panelRef.current?.contains(target) || target.closest('[data-search-toggle]')) return;
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
          className="fixed inset-y-5 left-28 z-10 w-100 overflow-hidden rounded-[32px] border border-border/60 bg-background shadow-float-raised max-md:hidden"
        >
          <SearchContent onSelect={close} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
