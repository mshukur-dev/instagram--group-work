'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { useUiStore } from '@/stores/ui-store';
import { isActive, navItems } from './nav-items';

const bottomKeys = ['home', 'explore', 'create', 'reels'];

// Phone only (<768px): Home, Explore, Create, Reels, Profile
export function BottomNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const openCreatePost = useUiStore((state) => state.openCreatePost);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 hidden h-[50px] items-center justify-around border-t bg-background max-md:flex">
      {navItems
        .filter((item) => bottomKeys.includes(item.key))
        .map(({ key, href, icon: Icon }) =>
          key === 'create' ? (
            <button
              key={key}
              type="button"
              aria-label={t(key)}
              onClick={openCreatePost}
              className="p-2"
            >
              <Icon className="size-6" />
            </button>
          ) : (
            <Link key={key} href={href} aria-label={t(key)} className="p-2">
              <Icon className="size-6" strokeWidth={isActive(pathname, href) ? 2.5 : 2} />
            </Link>
          ),
        )}
      <Link href={me ? `/${me.username}` : '/'} aria-label={t('profile')} className="p-2">
        <UserAvatar src={me?.avatarUrl ?? null} alt={t('profile')} size={24} />
      </Link>
    </nav>
  );
}
