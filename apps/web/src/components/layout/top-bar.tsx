'use client';

import { Heart, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';

// Phone only (<768px): logo, notifications and direct
export function TopBar() {
  const t = useTranslations('nav');

  return (
    <header className="fixed inset-x-0 top-0 z-20 hidden h-15 items-center justify-between border-b bg-background px-4 max-md:flex">
      <Link href="/" aria-label={t('home')}>
        <InstagramWordmark className="h-7 w-auto" />
      </Link>
      <div className="flex items-center gap-5">
        <Link href="/notifications" aria-label={t('notifications')}>
          <Heart className="size-6" />
        </Link>
        <Link href="/direct/inbox" aria-label={t('messages')}>
          <Send className="size-6" />
        </Link>
      </div>
    </header>
  );
}
