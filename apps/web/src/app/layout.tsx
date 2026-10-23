import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Instagram',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={cn('font-sans', inter.variable)}>
      <head>
        {/* The saved theme before the first paint, so a dark account never flashes white */}
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
