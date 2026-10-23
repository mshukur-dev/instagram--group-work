'use client';

import { Bookmark, Clapperboard, Grid3x3, SquareUserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'posts', path: '', icon: Grid3x3 },
  { key: 'reels', path: '/reels', icon: Clapperboard },
  { key: 'saved', path: '/saved', icon: Bookmark },
  { key: 'tagged', path: '/tagged', icon: SquareUserRound },
] as const;

// PROFILE-2: Saved is shown only on my own profile
export function ProfileTabs({ username, isMe }: { username: string; isMe: boolean }) {
  const t = useTranslations('profile.tabs');
  const pathname = usePathname();

  return (
    <nav className="flex justify-center gap-14 border-t border-border max-md:justify-around max-md:gap-0">
      {tabs
        .filter((tab) => tab.key !== 'saved' || isMe)
        .map(({ key, path, icon: Icon }) => {
          const href = `/${username}${path}`;
          const active = pathname === href;
          return (
            <Link
              key={key}
              href={href}
              aria-label={t(key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-13 items-center gap-1.5 text-xs font-semibold tracking-wider uppercase transition-colors duration-300',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {/* One line over the active tab: it slides to the new tab instead of jumping.
                  The layout stays mounted between the tab pages, so the line keeps its place. */}
              {active && (
                <motion.span
                  layoutId="profile-tab-line"
                  transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                  className="absolute inset-x-0 -top-px h-px bg-foreground"
                />
              )}
              <Icon className="size-3 max-md:size-6" strokeWidth={active ? 2.5 : 2} />
              <span className="max-md:hidden">{t(key)}</span>
            </Link>
          );
        })}
    </nav>
  );
}
