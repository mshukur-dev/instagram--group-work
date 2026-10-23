'use client';

import { ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { notFound, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'dashboard', href: '/admin' },
  { key: 'users', href: '/admin/users' },
  { key: 'content', href: '/admin/content' },
  { key: 'log', href: '/admin/log' },
] as const;

const isTabActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

// ADMIN-1: the page exists only for administrators; everyone else gets the regular 404.
// The API answers 404 to them as well, this check only spares a flash of the empty panel.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { data: me, isPending } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  const current = tabs.find(({ href }) => isTabActive(pathname, href)) ?? tabs[0];
  const title = `${t(`tabs.${current.key}`)} • ${t('title')} • Instagram`;

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
    <div className="mx-auto w-full max-w-270 px-10 pt-10 pb-16 max-md:px-4 max-md:pt-4">
      <header className="mb-8 flex items-end justify-between gap-6 max-md:mb-5 max-md:flex-col max-md:items-start">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-foreground text-background">
            <ShieldCheck className="size-5.5" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl leading-tight font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        <nav
          aria-label={t('title')}
          className="relative flex rounded-full bg-foreground/5 p-1 max-md:w-full max-md:overflow-x-auto"
        >
          {tabs.map(({ key, href }) => {
            const active = isTabActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-tab"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 420, damping: 38 }
                    }
                    className="absolute inset-0 rounded-full bg-background shadow-sm"
                  />
                )}
                <span className="relative">{t(`tabs.${key}`)}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}

/** Rounded card around tables and lists, same border as the rest of the site */
export function AdminCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-border bg-card', className)}>
      {children}
    </section>
  );
}

/** Small pill: role, status */
export function Pill({
  tone = 'muted',
  children,
  title,
}: {
  tone?: 'muted' | 'danger' | 'online' | 'strong';
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone === 'muted' && 'bg-foreground/6 text-muted-foreground',
        tone === 'danger' && 'bg-destructive/10 text-destructive',
        tone === 'online' && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
        tone === 'strong' && 'bg-foreground text-background',
      )}
    >
      {children}
    </span>
  );
}
