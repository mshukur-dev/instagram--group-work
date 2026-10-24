'use client';

import { Heart, Menu, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { useMe } from '@/features/profile/queries';
import { MoreMenu } from './more-menu';
import { NavBadge } from './nav-badge';
import { isActive } from './nav-items';

// Phone only (<768px): logo, notifications and direct, each with its red counter
export function TopBar() {
  const t = useTranslations('nav');
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const pathname = usePathname();
  const { data: me } = useMe();
  const notifications = me?.unreadNotificationsCount ?? 0;
  const messages = me?.unreadConversationsCount ?? 0;
  const onNotifications = isActive(pathname, '/notifications');
  const onMessages = isActive(pathname, '/direct');

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-20 hidden h-15 items-center justify-between border-b bg-background px-4 max-md:flex">
        <Link href="/" aria-label={t('home')}>
          <InstagramWordmark />
        </Link>
        <div className="flex items-center gap-6">
          {/* Settings, Saved, dark mode and Log out: the sidebar's More menu has no phone version */}
          <button
            type="button"
            data-more-toggle
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label={t('more')}
            onClick={() => setMoreOpen((open) => !open)}
            className="p-1"
          >
            <Menu className="size-6" strokeWidth={moreOpen ? 2.5 : 2} />
          </button>
          <Link
            href="/notifications"
            aria-label={t('notifications')}
            aria-current={onNotifications ? 'page' : undefined}
            className="relative p-1"
          >
            <Heart
              className={onNotifications ? 'size-6 fill-current' : 'size-6'}
              strokeWidth={onNotifications ? 2.5 : 2}
            />
            <NavBadge count={notifications} label={t('unread', { count: notifications })} />
          </Link>
          <Link
            href="/direct/inbox"
            aria-label={t('messages')}
            aria-current={onMessages ? 'page' : undefined}
            className="relative p-1"
          >
            <Send className="size-6" strokeWidth={onMessages ? 2.5 : 2} />
            <NavBadge count={messages} label={t('unread', { count: messages })} />
          </Link>
        </div>
      </header>
      {/* Outside the header, which has its own stacking level below the sheet */}
      {moreOpen && <MoreMenu anchor={null} onClose={closeMore} />}
    </>
  );
}
