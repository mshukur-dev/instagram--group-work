import { useTranslations } from 'next-intl';
import { GoogleIcon } from '@/components/icons/google-icon';
import { cn } from '@/lib/utils';

// A plain link, not Next <Link>: the browser must leave the app and follow the OAuth redirects.
export function GoogleButton({ variant }: { variant: 'primary' | 'outline' }) {
  const t = useTranslations('auth');
  return (
    // The rule mistakes /api/... for the /[username] page route
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/api/auth/google"
      className={cn(
        'flex items-center justify-center gap-2 text-sm font-semibold transition-colors outline-none',
        variant === 'primary' &&
          'bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:ring-ring/60 h-11 rounded-full focus-visible:ring-2',
        variant === 'outline' &&
          'border-border hover:bg-foreground/5 focus-visible:ring-ring/60 h-11 rounded-full border focus-visible:ring-2',
      )}
    >
      {variant === 'primary' ? (
        <span className="grid size-5 place-items-center rounded-full bg-white">
          <GoogleIcon className="size-3.5" />
        </span>
      ) : (
        <GoogleIcon className="size-5" />
      )}
      {t('continueWithGoogle')}
    </a>
  );
}

export function OrDivider() {
  const t = useTranslations('auth');
  return (
    <div className="my-4 flex items-center gap-4" role="separator">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-[13px] font-semibold">{t('or')}</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
