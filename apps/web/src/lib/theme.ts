import type { Theme } from '@instagram/shared';

// The account theme (SETTINGS-6). The last choice is also kept in localStorage, so the inline
// script in app/layout.tsx paints the right theme before React loads (no white flash).
export const THEME_STORAGE_KEY = 'theme';

/** The page background (--background) as a plain color, for the theme-color tag */
export const THEME_COLOR = { light: '#ffffff', dark: '#0a0a0a' } as const;

export const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(theme: Theme) {
  const dark = theme === 'DARK' || (theme === 'SYSTEM' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
  // The browser bar / installed app's status bar follows the theme (tag from themeInitScript)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode): the theme still applies for this visit
  }
}

/** Runs before the first paint, see app/layout.tsx */
export const themeInitScript = `try{var d=document.documentElement,t=localStorage.getItem('${THEME_STORAGE_KEY}');var dark=t==='DARK'||t==='dark'||(t==='SYSTEM'&&matchMedia('(prefers-color-scheme: dark)').matches);if(dark)d.classList.add('dark')}catch(e){}var m=document.createElement('meta');m.name='theme-color';m.content=dark?'${THEME_COLOR.dark}':'${THEME_COLOR.light}';document.head.appendChild(m);`;
