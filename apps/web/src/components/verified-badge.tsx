import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Instagram's blue check: a scalloped badge (twelve soft bumps) with a white tick
const BUMPS = 12;
const OUTER = 11.6;
const INNER = 10.2;
const ROSETTE = (() => {
  const points: string[] = [];
  for (let i = 0; i < BUMPS * 2; i++) {
    const r = i % 2 === 0 ? OUTER : INNER;
    const a = (i / (BUMPS * 2)) * Math.PI * 2 - Math.PI / 2;
    points.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return points.join(' ');
})();

/** Next to the name of a verified account; `size` in px (the name's line height suits it) */
export function VerifiedBadge({ size = 12, className }: { size?: number; className?: string }) {
  const t = useTranslations('profile');
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={t('verified')}
      className={cn('inline-block shrink-0 align-[-0.1em]', className)}
    >
      <title>{t('verified')}</title>
      <polygon
        points={ROSETTE}
        className="fill-brand stroke-brand"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
      <path
        d="m7.6 12.3 3 3 5.8-6.2"
        fill="none"
        stroke="white"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
