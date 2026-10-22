import { cn } from '@/lib/utils';

// Instagram's small profile buttons: blue for the main action, gray for the rest
export function profileButton(variant: 'primary' | 'secondary') {
  return cn(
    'inline-flex h-8 items-center justify-center gap-1 rounded-lg px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
    variant === 'primary'
      ? 'bg-brand text-brand-foreground hover:bg-brand-hover'
      : 'bg-secondary text-secondary-foreground hover:bg-foreground/10',
  );
}
