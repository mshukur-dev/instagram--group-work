'use client';

import { CircleX, Loader2, type LucideIcon, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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

/** The text of a search field, settled 300 ms after the last key press */
export function useDebounced(value: string, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value.trim()), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** The gray search field from Direct */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations('admin');
  return (
    <label
      className={cn(
        'flex h-9 items-center gap-2 rounded-lg bg-secondary px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring/40',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">{placeholder}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={64}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('clearSearch')}
          className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleX className="size-4" />
        </button>
      )}
    </label>
  );
}

/** Filter chips, like the ones in Instagram's notifications: the chosen one is filled */
export function Chips<T extends string>({
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
    <div role="radiogroup" aria-label={label} className="flex gap-2">
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
              'h-8 shrink-0 rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-foreground text-background'
                : 'bg-secondary text-secondary-foreground hover:bg-foreground/10',
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
  const { ref, inView } = useInView({ rootMargin: '600px' });
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

/** Empty list: the outlined circle with an icon, as on an empty profile tab */
export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-15.5 place-items-center rounded-full border-2 border-foreground">
        <Icon className="size-8" strokeWidth={1.5} />
      </span>
      <p className="text-xl font-extrabold">{title}</p>
      {text && <p className="max-w-80 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

/** A note instead of a list (load error) */
export function ListNote({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Gray placeholder rows, like the follower list while it loads */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 py-2">
          <div className="size-11 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-3 w-44 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
