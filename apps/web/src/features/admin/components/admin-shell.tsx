'use client';

import { Grid3x3, History, LayoutDashboard, type LucideIcon, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { notFound, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';

const sections: {
  key: 'dashboard' | 'users' | 'content' | 'log';
  href: string;
  icon: LucideIcon;
}[] = [
  { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'content', href: '/admin/content', icon: Grid3x3 },
  { key: 'log', href: '/admin/log', icon: History },
];

const isSectionActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

// ADMIN-1: the panel exists only for administrators; everyone else gets the regular 404.
// Same frame as Direct and Instagram's settings: a column of sections on the left, the
// open section on the right. Phone: the sections become a row of tabs above the content.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const { data: me, isPending } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  const current = sections.find(({ href }) => isSectionActive(pathname, href)) ?? sections[0];
  const title = `${t(`tabs.${current?.key ?? 'dashboard'}`)} • ${t('title')} • Instagram`;

  // Set here, not in server metadata, so the tab title never reveals /admin to others.
  // Next writes the root title after navigation, so put ours back whenever it changes;
  // the unread count in front, "(3) …", belongs to PushBridge and is kept.
  useEffect(() => {
    if (!isAdmin) return;
    const apply = () => {
      const count = /^\(\d+\) /.exec(document.title)?.[0] ?? '';
      if (document.title !== count + title) document.title = count + title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isAdmin, title]);

  if (isPending) return null;
  if (!isAdmin) notFound();

  return (
    <div className="flex min-h-dvh max-md:min-h-0 max-md:flex-col">
      <aside className="sticky top-0 h-dvh w-80 shrink-0 border-r border-border/60 px-4 pt-9 max-xl:w-64 max-md:static max-md:h-auto max-md:w-full max-md:border-r-0 max-md:border-b max-md:px-0 max-md:pt-3">
        <h1 className="px-3 pb-6 text-xl font-bold max-md:px-4 max-md:pb-3">{t('title')}</h1>
        <nav
          aria-label={t('title')}
          className="flex flex-col gap-1 max-md:flex-row max-md:overflow-x-auto max-md:px-2 max-md:pb-2 max-md:[scrollbar-width:none]"
        >
          {sections.map(({ key, href, icon: Icon }) => {
            const active = isSectionActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-md:shrink-0 max-md:py-2',
                  active ? 'bg-foreground/5 font-semibold' : 'hover:bg-foreground/4',
                )}
              >
                <Icon
                  className="size-6 shrink-0 max-md:size-5"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {t(`tabs.${key}`)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-12 pt-9 pb-16 max-xl:px-8 max-md:px-0 max-md:pt-4">
        <div className="mx-auto w-full max-w-233.75">{children}</div>
      </div>
    </div>
  );
}

/** Section heading, the same size as "Edit profile"; on a phone the section tabs say it */
export function AdminTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 max-md:hidden">
      <h2 className="text-xl font-bold">{children}</h2>
      {aside}
    </div>
  );
}
