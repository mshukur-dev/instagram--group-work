'use client';

import { Menu } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type FocusEvent, useState } from 'react';
import { InstagramIcon } from '@/components/icons/instagram-icon';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { isActive, navItems } from './nav-items';

// Slow, soft ease-in-out for every sidebar animation
const smooth = { duration: 0.45, ease: [0.4, 0, 0.2, 1] } as const;
const instant = { duration: 0 } as const;

const itemClass = cn(
  'flex items-center gap-4 rounded-full p-3 transition-colors outline-none',
  'hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring',
);
const activeClass = 'bg-foreground/[0.06] font-semibold';

// Icons only; expands over the page with labels on hover or keyboard focus.
// Phone: hidden (TopBar + BottomNav). Width and offset match the padding in (main)/layout.tsx.
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const [expanded, setExpanded] = useState(false);
  const transition = useReducedMotion() ? instant : smooth;

  const profileHref = me ? `/${me.username}` : '/';
  const profileActive = Boolean(me) && isActive(pathname, profileHref);

  // Collapse only when focus leaves the sidebar entirely
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
  };

  const label = (text: string) => (
    <motion.span
      initial={false}
      animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -12 }}
      transition={transition}
      className="whitespace-nowrap"
    >
      {text}
    </motion.span>
  );

  return (
    <motion.aside
      onHoverStart={() => setExpanded(true)}
      onHoverEnd={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={onBlur}
      initial={false}
      animate={{ width: expanded ? 256 : 80 }}
      transition={transition}
      className={cn(
        'fixed inset-y-0 left-5 z-20 my-auto flex h-fit w-[80px] flex-col overflow-hidden',
        'rounded-[40px] border border-border/60 bg-background px-4 py-8',
        'shadow-float transition-shadow duration-500 max-md:hidden',
        expanded && 'shadow-float-raised',
      )}
    >
      <Link href="/" aria-label={t('home')} className={cn(itemClass, 'relative mb-5 h-12 p-0')}>
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.span
              key="wordmark"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={transition}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <InstagramWordmark className="pt-1 text-[28px]" />
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={transition}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <InstagramIcon className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(itemClass, active && activeClass)}
            >
              <Icon className="size-6 shrink-0" strokeWidth={active ? 2.5 : 2} />
              {label(t(key))}
            </Link>
          );
        })}

        <Link
          href={profileHref}
          aria-current={profileActive ? 'page' : undefined}
          className={cn(itemClass, profileActive && activeClass)}
        >
          <UserAvatar
            src={me?.avatarUrl ?? null}
            alt={t('profile')}
            size={24}
            className={cn(profileActive && 'rounded-full ring-2 ring-foreground')}
          />
          {label(t('profile'))}
        </Link>
      </nav>

      <div className="mx-3 my-4 border-t border-border" />

      <button type="button" className={itemClass}>
        <Menu className="size-6 shrink-0" />
        {label(t('more'))}
      </button>
    </motion.aside>
  );
}
