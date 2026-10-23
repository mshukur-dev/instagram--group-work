'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { shortTimeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

/** Instagram-style "5m", "3d", like everywhere else on the site */
export function useTimeAgo() {
  const t = useTranslations('time');
  return (date: string) => {
    const { unit, count } = shortTimeAgo(date);
    return t(unit, { count });
  };
}

/** Small pill switch: sort order, filters, content type */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-foreground/5 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Loads the next page when it scrolls into view */
export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}) {
  const { ref, inView } = useInView({ rootMargin: '400px' });
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!hasNextPage) return null;
  return (
    <div ref={ref} className="flex justify-center py-5">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Centered note for empty and failed lists */
export function ListNote({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-14 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Placeholder rows while the first page loads */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-0"
        >
          <span className="size-9 animate-pulse rounded-full bg-foreground/6" />
          <span className="h-3.5 w-40 animate-pulse rounded bg-foreground/6" />
          <span className="ml-auto h-3.5 w-24 animate-pulse rounded bg-foreground/6" />
        </div>
      ))}
    </div>
  );
}
