'use client';

import {
  Archive,
  Ban,
  Bell,
  ChevronRight,
  CircleUserRound,
  KeyRound,
  Languages,
  Lock,
  MessageCircle,
  MonitorSmartphone,
  SunMoon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sections grouped like Instagram's settings; labels are keys in "settings.nav"
const groups = [
  {
    key: 'howYouUse',
    items: [
      { key: 'edit', icon: CircleUserRound },
      { key: 'notifications', icon: Bell },
    ],
  },
  {
    key: 'whoCanSee',
    items: [
      { key: 'privacy', icon: Lock },
      { key: 'blocked', icon: Ban },
      { key: 'archive', icon: Archive },
    ],
  },
  { key: 'interactions', items: [{ key: 'messages', icon: MessageCircle }] },
  {
    key: 'appAndMedia',
    items: [
      { key: 'appearance', icon: SunMoon },
      { key: 'language', icon: Languages },
    ],
  },
  {
    key: 'security',
    items: [
      { key: 'password', icon: KeyRound },
      { key: 'sessions', icon: MonitorSmartphone },
    ],
  },
] as const;

// Desktop: a column on the left of every settings page. Phone: the /accounts page itself,
// a list where each row opens its section.
export function SettingsNav({ variant }: { variant: 'column' | 'list' }) {
  const t = useTranslations('settings.nav');
  const pathname = usePathname();
  const column = variant === 'column';

  return (
    <nav
      className={cn(
        column
          ? 'sticky top-0 h-dvh w-80 shrink-0 overflow-y-auto scrollbar-none border-r border-border px-4 py-9 max-md:hidden'
          : 'px-2 py-4',
      )}
    >
      <h1 className="px-3 pb-6 text-xl font-bold">{t('title')}</h1>
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
              {t(`groups.${group.key}`)}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map(({ key, icon: Icon }) => {
                const href = `/accounts/${key}`;
                const active = column && pathname === href;
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6',
                        active && 'bg-foreground/6 font-semibold hover:bg-foreground/6',
                      )}
                    >
                      <Icon className="size-6 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                      <span className="flex-1">{t(key)}</span>
                      {!column && <ChevronRight className="size-5 text-muted-foreground" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
