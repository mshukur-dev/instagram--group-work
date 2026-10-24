import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Inter } from 'next/font/google';
import { themeInitScript } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

// Cyrillic is needed for the Russian interface
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
// The same colorful emoji on every system (Windows' own are flat). Loaded by the browser, not at
// build time: the font is large and a slow connection made the build fail. Only the pieces of
// the font with emoji that are on screen get downloaded.
const EMOJI_FONT_URL = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap';

// Icons come from app/icon.svg and app/apple-icon.png, the manifest from app/manifest.ts
// (docs/spec/pwa.md)
export const metadata: Metadata = {
  title: 'Instagram',
  applicationName: 'Instagram',
  // iPhone: "Add to Home Screen" opens the site full screen, with the status bar in the page color
  appleWebApp: { capable: true, title: 'Instagram', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The page reaches under the iPhone's home indicator; bars pad themselves with safe-area insets
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={cn('font-sans', inter.variable)}>
      <head>
        {/* The saved theme before the first paint, so a dark account never flashes white. It also
            adds the theme-color tag (browser bar / installed app's status bar): made by the script,
            not by React or `viewport.themeColor`, which re-render it on navigation */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={EMOJI_FONT_URL} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
