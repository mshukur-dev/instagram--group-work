import type { Theme } from '@instagram/shared';

// The account theme (SETTINGS-6). The last choice is also kept in localStorage, so the inline
// script in app/layout.tsx paints the right theme before React loads (no white flash).
export const THEME_STORAGE_KEY = 'theme';

export const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(theme: Theme) {
  const dark = theme === 'DARK' || (theme === 'SYSTEM' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode): the theme still applies for this visit
  }
}

/** Runs before the first paint, see app/layout.tsx */
export const themeInitScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='DARK'||t==='dark'||(t==='SYSTEM'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
