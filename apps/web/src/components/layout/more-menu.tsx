'use client';

import { Bookmark, ChevronLeft, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLogout } from '@/features/auth/queries';
import { useMe } from '@/features/profile/queries';
import { Switch } from '@/features/settings/components/settings-ui';
import { useUpdateSettings } from '@/features/settings/queries';
import { applyTheme, prefersDark } from '@/lib/theme';
import { switchThemeWithReveal } from '@/lib/theme-transition';

const rowClass =
  'flex w-full items-center gap-3 rounded-lg p-4 text-left text-sm outline-none transition-colors hover:bg-foreground/6 focus-visible:bg-foreground/6';

// Instagram's "More" menu: opens above the sidebar's More button (`anchor`). Settings, Saved,
// Switch appearance (a second page with the dark mode switch) and Log out.
export function MoreMenu({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const t = useTranslations('more');
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLSpanElement>(null);
  const { data: me } = useMe();
  const logout = useLogout();
  const update = useUpdateSettings();
  const [page, setPage] = useState<'main' | 'appearance'>('main');

  const firstPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPath.current) onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (ref.current?.contains(target) || target.closest('[data-more-toggle]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  const dark = me ? me.theme === 'DARK' || (me.theme === 'SYSTEM' && prefersDark()) : false;

  const toggleDark = (next: boolean, origin: HTMLElement) => {
    const theme = next ? 'DARK' : 'LIGHT';
    switchThemeWithReveal(origin, () => applyTheme(theme));
    update.mutate({ theme });
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      style={{ left: anchor.left, bottom: window.innerHeight - anchor.top + 8 }}
      className="fixed z-40 w-66 origin-bottom-left overflow-hidden rounded-2xl border border-border/60 bg-card p-2 shadow-float-raised max-md:hidden"
    >
      <AnimatePresence initial={false} mode="wait">
        {page === 'main' ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
          >
            <Link href="/accounts/edit" role="menuitem" onClick={onClose} className={rowClass}>
              <Settings className="size-5" />
              {t('settings')}
            </Link>
            {me && (
              <Link
                href={`/${me.username}/saved`}
                role="menuitem"
                onClick={onClose}
                className={rowClass}
              >
                <Bookmark className="size-5" />
                {t('saved')}
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => setPage('appearance')}
              className={rowClass}
            >
              {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
              {t('appearance')}
            </button>
            <div className="-mx-2 my-2 h-1.5 bg-foreground/5" />
            <button
              type="button"
              role="menuitem"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              className={rowClass}
            >
              <LogOut className="size-5" />
              {t('logOut')}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
          >
            <div className="flex items-center gap-2 border-b border-border px-2 pt-2 pb-3">
              <button
                type="button"
                onClick={() => setPage('main')}
                aria-label={t('back')}
                className="grid size-8 place-items-center rounded-full hover:bg-foreground/6"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="flex-1 font-semibold">{t('appearance')}</span>
              {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </div>
            <div className="flex items-center justify-between gap-3 p-4 text-sm">
              <span id="more-dark-mode">{t('darkMode')}</span>
              {/* The new theme grows out of the switch */}
              <span ref={switchRef} className="flex">
                <Switch
                  checked={dark}
                  onChange={(next) => switchRef.current && toggleDark(next, switchRef.current)}
                  labelledBy="more-dark-mode"
                />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
