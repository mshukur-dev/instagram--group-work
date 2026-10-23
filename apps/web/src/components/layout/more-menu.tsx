'use client';

import { Bookmark, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLogout } from '@/features/auth/queries';
import { useMe } from '@/features/profile/queries';
import { useUpdateSettings } from '@/features/settings/queries';
import { applyTheme, prefersDark } from '@/lib/theme';
import { switchThemeWithReveal } from '@/lib/theme-transition';
import { cn } from '@/lib/utils';

type Item = 'settings' | 'saved' | 'appearance' | 'logout';

const rowClass =
  'relative flex h-12 w-full items-center gap-3.5 rounded-full px-4 text-left text-[15px] outline-none';

// Instagram's "More" menu, dressed like our sidebar: the same floating surface, round rows with
// one highlight that glides from row to row, dark mode switched right in its row, and Log out in
// red below a hairline. It opens above the sidebar's More button (`anchor`) and closes with the
// sidebar (the sidebar calls `onClose` when it collapses).
export function MoreMenu({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const t = useTranslations('more');
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLSpanElement>(null);
  const { data: me } = useMe();
  const logout = useLogout();
  const update = useUpdateSettings();
  const [hover, setHover] = useState<Item | null>(null);

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

  const toggleDark = () => {
    const theme = dark ? 'LIGHT' : 'DARK';
    const origin = switchRef.current;
    if (origin) switchThemeWithReveal(origin, () => applyTheme(theme));
    else applyTheme(theme);
    update.mutate({ theme });
  };

  /** Hover and keyboard focus both move the highlight onto a row */
  const track = (item: Item) => ({
    onMouseEnter: () => setHover(item),
    onFocus: () => setHover(item),
  });

  const highlight = (item: Item, danger = false) =>
    hover === item && (
      <motion.span
        layoutId="more-menu-highlight"
        aria-hidden="true"
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }
        }
        className={cn(
          'absolute inset-0 rounded-full',
          danger ? 'bg-destructive/8 dark:bg-destructive/12' : 'bg-foreground/6',
        )}
      />
    );

  return (
    <motion.div
      ref={ref}
      role="menu"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34 }}
      // Sits inside the open sidebar, 8px in from each side
      style={{ left: anchor.left - 9, bottom: window.innerHeight - anchor.top + 10 }}
      onMouseLeave={() => setHover(null)}
      className="fixed z-40 w-60 origin-bottom-left rounded-[28px] border border-border/60 bg-background p-2 shadow-float-raised max-md:hidden"
    >
      <Link
        href="/accounts/edit"
        role="menuitem"
        onClick={onClose}
        className={rowClass}
        {...track('settings')}
      >
        {highlight('settings')}
        <Settings className="relative size-5.5 shrink-0" />
        <span className="relative">{t('settings')}</span>
      </Link>

      {me && (
        <Link
          href={`/${me.username}/saved`}
          role="menuitem"
          onClick={onClose}
          className={rowClass}
          {...track('saved')}
        >
          {highlight('saved')}
          <Bookmark className="relative size-5.5 shrink-0" />
          <span className="relative">{t('saved')}</span>
        </Link>
      )}

      {/* The whole row flips the theme; the switch shows where it stands */}
      <div
        role="menuitemcheckbox"
        aria-checked={dark}
        tabIndex={0}
        onClick={toggleDark}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleDark();
          }
        }}
        className={cn(rowClass, 'cursor-pointer pr-3')}
        {...track('appearance')}
      >
        {highlight('appearance')}
        <span className="relative grid size-5.5 shrink-0 place-items-center">
          <motion.span
            key={dark ? 'moon' : 'sun'}
            initial={reduceMotion ? false : { rotate: -60, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="grid place-items-center"
          >
            {dark ? <Moon className="size-5.5" /> : <Sun className="size-5.5" />}
          </motion.span>
        </span>
        <span className="relative flex-1">{t('darkMode')}</span>
        {/* The new theme grows out of the switch; the row handles the click */}
        <span
          ref={switchRef}
          aria-hidden="true"
          className={cn(
            'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
            dark ? 'bg-foreground' : 'bg-foreground/20',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform duration-200',
              dark && 'translate-x-4',
            )}
          />
        </span>
      </div>

      <div className="mx-4 my-1.5 h-px bg-border/70" />

      <button
        type="button"
        role="menuitem"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        className={cn(rowClass, 'text-destructive disabled:opacity-60')}
        {...track('logout')}
      >
        {highlight('logout', true)}
        <LogOut className="relative size-5.5 shrink-0" />
        <span className="relative font-medium">{t('logOut')}</span>
      </button>
    </motion.div>
  );
}
