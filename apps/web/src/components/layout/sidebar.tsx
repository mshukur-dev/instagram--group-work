'use client';

import { Menu } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
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

// Slow, soft ease-in-out for opening the sidebar
const smooth = { duration: 0.45, ease: [0.4, 0, 0.2, 1] } as const;
// Springy glide for the hover highlight moving between items
const glide = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 } as const;
const instant = { duration: 0 } as const;

const itemClass =
  'relative flex items-center gap-4 rounded-full p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring';
// The current page keeps a quiet fill; the hover highlight glides on top of it
const activeClass = 'bg-foreground/[0.04] font-semibold';

// Icons only; expands over the page with labels on hover or keyboard focus.
// One highlight glides between items under the pointer (or keyboard focus).
// Phone: hidden (TopBar + BottomNav). Width and offset match the padding in (main)/layout.tsx.
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const profileHref = me ? `/${me.username}` : '/';
  const profileActive = Boolean(me) && isActive(pathname, profileHref);

  const collapse = () => {
    setExpanded(false);
    setHovered(null);
  };

  // Collapse only when focus leaves the sidebar entirely
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) collapse();
  };

  // Pointer and keyboard focus both move the highlight
  const track = (key: string) => ({
    onMouseEnter: () => setHovered(key),
    onFocus: () => setHovered(key),
  });

  const highlight = (key: string) =>
    hovered === key && (
      <motion.span
        layoutId="sidebar-highlight"
        transition={reduceMotion ? instant : glide}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 rounded-full bg-foreground/[0.06]"
      />
    );

  const label = (text: string) => (
    <motion.span
      initial={false}
      animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -12 }}
      transition={reduceMotion ? instant : smooth}
      className="relative whitespace-nowrap"
    >
      {text}
    </motion.span>
  );

  return (
    <motion.aside
      onHoverStart={() => setExpanded(true)}
      onHoverEnd={collapse}
      onFocus={() => setExpanded(true)}
      onBlur={onBlur}
      initial={false}
      animate={{ width: expanded ? 256 : 80 }}
      transition={reduceMotion ? instant : smooth}
      className={cn(
        'fixed inset-y-0 left-5 z-20 my-auto flex h-fit w-[80px] flex-col overflow-hidden',
        'rounded-[40px] border border-border/60 bg-background px-4 py-8',
        'shadow-float transition-shadow duration-500 max-md:hidden',
        expanded && 'shadow-float-raised',
      )}
    >
      <Link
        href="/"
        aria-label={t('home')}
        className="relative mb-5 block h-12 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.span
              key="wordmark"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={reduceMotion ? instant : smooth}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <InstagramWordmark />
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={reduceMotion ? instant : smooth}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <InstagramIcon className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      <LayoutGroup id="sidebar">
        <nav className="flex flex-col gap-1" onMouseLeave={() => setHovered(null)}>
          {navItems.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(itemClass, active && activeClass)}
                {...track(key)}
              >
                <AnimatePresence>{highlight(key)}</AnimatePresence>
                <Icon className="relative size-6 shrink-0" strokeWidth={active ? 2.5 : 2} />
                {label(t(key))}
              </Link>
            );
          })}

          <Link
            href={profileHref}
            aria-current={profileActive ? 'page' : undefined}
            className={cn(itemClass, profileActive && activeClass)}
            {...track('profile')}
          >
            <AnimatePresence>{highlight('profile')}</AnimatePresence>
            <UserAvatar
              src={me?.avatarUrl ?? null}
              alt={t('profile')}
              size={24}
              className={cn('relative', profileActive && 'rounded-full ring-2 ring-foreground')}
            />
            {label(t('profile'))}
          </Link>
        </nav>

        <div className="mx-3 my-4 border-t border-border" />

        <div onMouseLeave={() => setHovered(null)}>
          <button type="button" className={cn(itemClass, 'w-full')} {...track('more')}>
            <AnimatePresence>{highlight('more')}</AnimatePresence>
            <Menu className="relative size-6 shrink-0" />
            {label(t('more'))}
          </button>
        </div>
      </LayoutGroup>
    </motion.aside>
  );
}
