import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Geist, Grand_Hotel } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

// Cyrillic is needed for the Russian interface
const geist = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
// Script face closest to the Instagram wordmark
const grandHotel = Grand_Hotel({ weight: '400', subsets: ['latin'], variable: '--font-grand-hotel' });

export const metadata: Metadata = {
  title: 'Instagram',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={cn('font-sans', geist.variable, grandHotel.variable)}>
      <body className="bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
