'use client';

import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { switchThemeWithReveal } from '@/lib/theme-transition';

const STORAGE_KEY = 'theme';

// TEMPORARY, development only: flips the `.dark` class so both themes can be reviewed.
// Replace with the real Appearance setting (docs/spec/frontend.md, accounts/appearance).
export function DevThemeToggle() {
  const t = useTranslations('common');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) === 'dark';
    document.documentElement.classList.toggle('dark', saved);
    setDark(saved);
  }, []);

  if (process.env.NODE_ENV === 'production') return null;

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = !dark;
    switchThemeWithReveal(event.currentTarget, () => {
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      setDark(next);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('toggleTheme')}
      className="bg-card text-card-foreground shadow-float-raised border-border/40 hover:bg-accent focus-visible:ring-ring fixed right-5 bottom-5 z-50 grid size-11 place-items-center overflow-hidden rounded-full border outline-none focus-visible:ring-2"
    >
      {/* The new icon spins in, the old one spins out */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={dark ? 'sun' : 'moon'}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
