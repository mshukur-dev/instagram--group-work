import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Instagram wordmark set in the Grand Hotel script face (see layout.tsx).
// Live text instead of a traced SVG: crisp at any size and follows the theme color.
// Size it with a text-* class.
export function InstagramWordmark({ className }: { className?: string }) {
  const t = useTranslations('common');

  return (
    <span
      aria-hidden="true"
      className={cn('font-logo leading-none tracking-[0.01em] select-none', className)}
    >
      {t('appName')}
    </span>
  );
}
