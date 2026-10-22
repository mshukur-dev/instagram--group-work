import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { GoBackButton } from '@/components/go-back-button';
import { NotFoundRing } from '@/components/not-found-ring';
import { AuthShell } from '@/features/auth/components/auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  return { title: t('pageTitle') };
}

// Any URL that has no page (and `notFound()` calls): same look as the auth pages, one drawing
export default async function NotFound() {
  const t = await getTranslations('notFound');
  const button =
    'h-10 rounded-lg px-5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

  return (
    <AuthShell>
      <div className="flex max-w-sm flex-col items-center gap-8 text-center">
        <NotFoundRing label={t('ringLabel')} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-light">{t('title')}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{t('body')}</p>
        </div>
        <div className="flex items-center gap-2">
          <GoBackButton
            className={`${button} bg-secondary text-secondary-foreground hover:bg-secondary/70`}
          >
            {t('goBack')}
          </GoBackButton>
          <Link
            href="/"
            className={`${button} bg-brand text-brand-foreground hover:bg-brand-hover grid place-items-center`}
          >
            {t('goHome')}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
