import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Inter, Noto_Color_Emoji } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

// Cyrillic is needed for the Russian interface
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
// The same colorful emoji on every system (Windows' own are flat). Only the pieces of the font
// with emoji that are on screen get downloaded.
const emoji = Noto_Color_Emoji({ weight: '400', subsets: ['emoji'], variable: '--font-emoji' });

export const metadata: Metadata = {
  title: 'Instagram',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, emoji.variable)}
    >
      <body className="bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
