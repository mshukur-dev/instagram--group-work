'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId } from 'react';
import { cn } from '@/lib/utils';

// Building blocks shared by every settings section, so they all look the same

/** A section: back arrow (phone), title, optional hint, then the content */
export function SettingsPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('settings');
  return (
    <div className="mx-auto w-full max-w-175 space-y-6 px-5 py-9 max-md:px-4 max-md:py-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href="/accounts"
            aria-label={t('back')}
            className="-ml-2 hidden size-9 place-items-center rounded-full hover:bg-foreground/6 max-md:grid"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** A rounded box around a group of rows */
export function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border rounded-2xl border border-border">{children}</div>;
}

export function SettingsLoading() {
  return (
    <div className="grid place-items-center py-16 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

/** Instagram's on / off switch */
export function Switch({
  checked,
  onChange,
  disabled,
  labelledBy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        checked ? 'bg-foreground' : 'bg-foreground/20',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform duration-200',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}

/** A row with a label, an optional hint and a switch */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p id={id}>{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} labelledBy={id} />
    </div>
  );
}

/** One choice of a group: the whole row is clickable, a round mark shows the selected one */
export function OptionRow({
  label,
  description,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-4 p-4 text-left outline-none transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-foreground/4 focus-visible:bg-foreground/6 disabled:opacity-50"
    >
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
          selected ? 'border-foreground' : 'border-foreground/30',
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-foreground" />}
      </span>
    </button>
  );
}
