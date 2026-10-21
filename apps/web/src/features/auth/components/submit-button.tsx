import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubmitButtonProps = React.ComponentProps<'button'> & { pending?: boolean };

export function SubmitButton({ pending, disabled, children, className, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        'bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:ring-ring/60 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : children}
    </button>
  );
}
