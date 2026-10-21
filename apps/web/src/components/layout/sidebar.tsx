'use client';

import { Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { InstagramIcon } from '@/components/icons/instagram-icon';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { isActive, navItems } from './nav-items';

// Slow, soft ease-in-out for every sidebar animation
const smooth = { duration: 0.5, ease: [0.4, 0, 0.2, 1] } as const;

function Label({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: show ? 1 : 0, x: show ? 0 : -12 }}
      transition={smooth}
      className="whitespace-nowrap"
    >
      {children}
    </motion.span>
  );
}

const itemClass = 'flex items-center gap-4 rounded-full p-3 transition-colors hover:bg-foreground/5';

// Icons only; expands over the page with labels on hover. Phone: hidden (TopBar + BottomNav).
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.aside
      onHoverStart={() => setExpanded(true)}
      onHoverEnd={() => setExpanded(false)}
      initial={false}
      animate={{ width: expanded ? 256 : 80 }}
      transition={smooth}
      className={cn(
        'fixed inset-y-0 left-3 z-20 my-auto flex h-fit w-[80px] flex-col overflow-hidden rounded-[40px] bg-background px-4 py-10 shadow-sm transition-shadow duration-500 max-md:hidden',
        expanded && 'shadow-md',
      )}
    >
      <Link href="/" aria-label={t('home')} className="relative mb-4 block h-12">
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.span
              key="wordmark"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={smooth}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <InstagramWordmark className="h-7 w-auto" />
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={smooth}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <InstagramIcon className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      <nav className="flex flex-col gap-1.5">
        {navItems.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={key} href={href} className={cn(itemClass, active && 'font-bold')}>
              <Icon className="size-6 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <Label show={expanded}>{t(key)}</Label>
            </Link>
          );
        })}

        <Link href={me ? `/${me.username}` : '/'} className={itemClass}>
          <UserAvatar src={me?.avatarUrl ?? null} alt={t('profile')} size={24} />
          <Label show={expanded}>{t('profile')}</Label>
        </Link>
      </nav>

      <button type="button" className={cn(itemClass, 'mt-6')}>
        <Menu className="size-6 shrink-0" />
        <Label show={expanded}>{t('more')}</Label>
      </button>
    </motion.aside>
  );
}
