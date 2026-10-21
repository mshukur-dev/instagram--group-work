import { useTranslations } from 'next-intl';
import { GoogleIcon } from '@/components/icons/google-icon';
import { cn } from '@/lib/utils';

// A plain link, not Next <Link>: the browser must leave the app and follow the OAuth redirects.
export function GoogleButton({ variant }: { variant: 'primary' | 'link' }) {
  const t = useTranslations('auth');
  return (
    <a
      href="/api/auth/google"
      className={cn(
        'flex items-center justify-center gap-2 text-sm font-semibold transition-colors outline-none',
        variant === 'primary'
          ? 'bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:ring-ring/60 h-11 rounded-lg focus-visible:ring-2'
          : 'text-brand hover:text-brand-hover focus-visible:underline',
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
