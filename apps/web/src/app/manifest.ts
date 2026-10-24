import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';

// The web app manifest (docs/spec/pwa.md): what the phone or computer needs to install the site
// as an app. Served at /manifest.webmanifest, linked from every page by Next.js. Texts follow the
// interface language (the NEXT_LOCALE cookie), like the rest of the site.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations('pwa');

  return {
    id: '/',
    name: 'Instagram',
    short_name: 'Instagram',
    description: t('description'),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Full-bleed: Android crops it to its own shape (circle, squircle)
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long press on the app icon
    shortcuts: [
      {
        name: t('shortcutMessages'),
        url: '/direct/inbox',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
      },
      {
        name: t('shortcutNotifications'),
        url: '/notifications',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
      },
      {
        name: t('shortcutReels'),
        url: '/reels',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
      },
    ],
  };
}
