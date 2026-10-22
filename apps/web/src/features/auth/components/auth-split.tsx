'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InstagramIcon } from '@/components/icons/instagram-icon';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { cn } from '@/lib/utils';
import { StoryDeck } from './story-deck';

type Props = {
  heroTitle: 'loginHeroTitle' | 'signupHeroTitle';
  heading: string;
  /** Outlined pill under the form that leads to the other auth page */
  switchLink: { href: string; label: string };
  children: React.ReactNode;
};

const rise = 'motion-safe:animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both]';
const languages = ['en', 'ru'] as const;

// Before login there is no account language yet, so the choice goes into the cookie (docs/spec/i18n.md)
function LanguageSwitch() {
  const t = useTranslations('common.languages');
  const locale = useLocale();
  const router = useRouter();

  const choose = (language: (typeof languages)[number]) => {
    document.cookie = `NEXT_LOCALE=${language}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="flex gap-3">
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          onClick={() => choose(language)}
          aria-pressed={locale === language}
          className={cn(
            'rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            locale === language ? 'font-semibold text-foreground' : 'hover:text-foreground',
          )}
        >
          {t(language)}
        </button>
      ))}
    </div>
  );
}

// Login and sign-up: a story deck that plays by itself on the left, the form on the right.
// Both columns rise in piece by piece once; below 1024px only the form column is shown.
export function AuthSplit({ heroTitle, heading, switchLink, children }: Props) {
  const t = useTranslations('auth');

  return (
    <main className="flex min-h-dvh">
      <section className="relative isolate flex flex-1 flex-col items-center justify-center gap-12 overflow-hidden px-16 py-24 max-lg:hidden">
        {/* Soft glow of the story-ring colors behind the stories half only */}
        <div
          aria-hidden="true"
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 motion-safe:animate-[aurora-in_1.4s_ease-out_both]"
        />
        <InstagramIcon className={cn('absolute top-8 left-8 size-10', rise)} />
        <h2
          className={cn('max-w-130 text-center text-[44px] leading-[1.15] tracking-tight', rise)}
          style={{ animationDelay: '80ms' }}
        >
          {t.rich(heroTitle, {
            accent: (chunks) => (
              <span className="bg-story-ring bg-clip-text font-medium text-transparent">
                {chunks}
              </span>
            ),
          })}
        </h2>
        <div className={rise} style={{ animationDelay: '160ms' }}>
          <StoryDeck />
        </div>
      </section>

      <section className="relative isolate flex w-130 shrink-0 flex-col overflow-hidden border-l border-border px-16 py-10 max-lg:w-full max-lg:border-l-0 max-md:px-6">
        <div className="mx-auto my-auto w-full max-w-95 py-6">
          <InstagramWordmark className={cn('mx-auto h-12.75', rise)} />
          <h1
            className={cn('mt-6 mb-7 text-center text-xl font-semibold text-balance', rise)}
            style={{ animationDelay: '80ms' }}
          >
            {heading}
          </h1>
          <div className={rise} style={{ animationDelay: '160ms' }}>
            {children}
            <Link
              href={switchLink.href}
              className="mt-3 flex h-11 items-center justify-center rounded-full border border-brand text-sm font-semibold text-brand transition-colors outline-none hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {switchLink.label}
            </Link>
          </div>
        </div>

        <footer className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <LanguageSwitch />
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
        </footer>
      </section>
    </main>
  );
}
