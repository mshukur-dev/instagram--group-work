'use client';

import { LogOut, Menu, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type FocusEvent, useRef, useState } from 'react';
import { InstagramIcon } from '@/components/icons/instagram-icon';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { UserAvatar } from '@/components/user-avatar';
import { useLogout } from '@/features/auth/queries';
import { useUiStore } from '@/stores/ui-store';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { NavBadge } from './nav-badge';
import { isActive, navItems } from './nav-items';

// Slow, soft ease-in-out for opening the sidebar
const smooth = { duration: 0.45, ease: [0.4, 0, 0.2, 1] } as const;
// Critically damped spring: glides to the item and settles without overshoot or wobble
const glide = { type: 'spring', stiffness: 380, damping: 40, mass: 0.9 } as const;
const fade = { duration: 0.2, ease: 'easeOut' } as const;
const instant = { duration: 0 } as const;

const itemClass =
  'relative flex items-center gap-4 rounded-full p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring';
// The current page keeps a quiet fill; the hover highlight glides on top of it
const activeClass = 'bg-foreground/4 font-semibold';

type Spot = { top: number; height: number };
// The highlight turns red over destructive items (data-tone="danger")
type Tone = 'default' | 'danger';

// Icons only; expands over the page with labels on hover or keyboard focus.
// A single highlight moves between items under the pointer (or keyboard focus): it never
// unmounts while moving, so there is no cross-fade flicker; it only fades when the pointer
// leaves the menu. Phone: hidden (TopBar + BottomNav).
// Width and offset match the padding in (main)/layout.tsx.
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const [expanded, setExpanded] = useState(false);
  const logout = useLogout();
  const openCreatePost = useUiStore((state) => state.openCreatePost);
  const createOpen = useUiStore((state) => state.createPostOpen);
  const reduceMotion = useReducedMotion();

  const menuRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [visible, setVisible] = useState(false);
  const [tone, setTone] = useState<Tone>('default');
  // When the highlight appears it jumps to the item instead of flying in from its last spot
  const [jump, setJump] = useState(true);

  const profileHref = me ? `/${me.username}` : '/';
  const profileActive = Boolean(me) && isActive(pathname, profileHref);

  const moveTo = (item: HTMLElement) => {
    const menu = menuRef.current;
    if (!menu) return;
    const menuTop = menu.getBoundingClientRect().top;
    const rect = item.getBoundingClientRect();
    setJump(!visible);
    setTone(item.dataset.tone === 'danger' ? 'danger' : 'default');
    setSpot({ top: rect.top - menuTop, height: rect.height });
    setVisible(true);
  };

  const hideHighlight = () => setVisible(false);

  const collapse = () => {
    setExpanded(false);
    hideHighlight();
  };

  // Collapse only when focus leaves the sidebar entirely
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) collapse();
  };

  // Pointer and keyboard focus both move the highlight
  const track = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => moveTo(event.currentTarget),
    onFocus: (event: React.FocusEvent<HTMLElement>) => moveTo(event.currentTarget),
  };

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
        'fixed inset-y-0 left-5 z-20 my-auto flex h-fit w-20 flex-col overflow-hidden',
        'rounded-[40px] border border-border/60 bg-background px-4 py-8',
        'shadow-float transition-shadow duration-500 max-md:hidden',
        expanded && 'shadow-float-raised',
      )}
    >
      <Link
        href="/"
        aria-label={t('home')}
        className="relative mb-4 block h-12 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {/* One container for all items, so the highlight survives crossing the divider */}
      <div ref={menuRef} className="relative" onMouseLeave={hideHighlight}>
        {spot && (
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{ y: spot.top, height: spot.height, opacity: visible ? 1 : 0 }}
            transition={{
              y: reduceMotion || jump ? instant : glide,
              height: reduceMotion || jump ? instant : glide,
              opacity: reduceMotion ? instant : fade,
            }}
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 rounded-full transition-colors duration-200',
              // Barely-there red tint: the red lives in the icon and text, not in the fill
              tone === 'danger' ? 'bg-destructive/6 dark:bg-destructive/10' : 'bg-foreground/6',
            )}
          />
        )}

        <nav className="flex flex-col gap-1">
          {navItems.map(({ key, href, icon: Icon }) => {
            // Create opens the create-post dialog instead of navigating
            if (key === 'create') {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={openCreatePost}
                  className={cn(itemClass, 'w-full', createOpen && activeClass)}
                  {...track}
                >
                  <Icon className="relative size-6 shrink-0" strokeWidth={createOpen ? 2.5 : 2} />
                  {label(t(key))}
                </button>
              );
            }
            const active = isActive(pathname, href);
            const unread =
              key === 'notifications'
                ? (me?.unreadNotificationsCount ?? 0)
                : key === 'messages'
                  ? (me?.unreadConversationsCount ?? 0)
                  : 0;
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(itemClass, active && activeClass)}
                {...track}
              >
                <span className="relative shrink-0">
                  <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                  <NavBadge count={unread} label={t('unread', { count: unread })} />
                </span>
                {label(t(key))}
              </Link>
            );
          })}

          <Link
            href={profileHref}
            aria-current={profileActive ? 'page' : undefined}
            className={cn(itemClass, profileActive && activeClass)}
            {...track}
          >
            <UserAvatar
              src={me?.avatarUrl ?? null}
              alt={t('profile')}
              size={24}
              className={cn('relative', profileActive && 'rounded-full ring-2 ring-foreground')}
            />
            {label(t('profile'))}
          </Link>

          {/* ADMIN-1: only administrators see the panel */}
          {me?.role === 'ADMIN' && (
            <Link
              href="/admin"
              aria-current={isActive(pathname, '/admin') ? 'page' : undefined}
              className={cn(itemClass, isActive(pathname, '/admin') && activeClass)}
              {...track}
            >
              <ShieldCheck
                className="relative size-6 shrink-0"
                strokeWidth={isActive(pathname, '/admin') ? 2.5 : 2}
              />
              {label(t('admin'))}
            </Link>
          )}
        </nav>

        <div className="mx-3 my-4 border-t border-border" />

        <div className="flex flex-col gap-1">
          <button type="button" className={cn(itemClass, 'w-full')} {...track}>
            <Menu className="relative size-6 shrink-0" />
            {label(t('more'))}
          </button>

          {/* Temporary: moves into the More menu / settings when those pages exist */}
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            data-tone="danger"
            className={cn(itemClass, 'w-full text-destructive disabled:opacity-50')}
            {...track}
          >
            <LogOut className="relative size-6 shrink-0" />
            {label(t('logOut'))}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
