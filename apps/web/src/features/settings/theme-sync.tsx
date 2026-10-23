'use client';

import { useEffect } from 'react';
import { useMe } from '@/features/profile/queries';
import { applyTheme } from '@/lib/theme';

// Keeps the page in the account's theme (SETTINGS-6). "As the device" follows the system
// switch live. Mounted once in the main layout; renders nothing.
export function ThemeSync() {
  const { data: me } = useMe();
  const theme = me?.theme;

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    if (theme !== 'SYSTEM') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('SYSTEM');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return null;
}
