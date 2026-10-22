import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubmitButtonProps = React.ComponentProps<'button'> & { pending?: boolean };

export function SubmitButton({
  pending,
  disabled,
  children,
  className,
  ...props
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        'bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:ring-ring/60 relative flex h-11 w-full items-center justify-center overflow-hidden rounded-lg text-sm font-semibold transition-[background-color,opacity,scale] duration-200 outline-none focus-visible:ring-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60',
        // A light sheen runs across the button on hover
        'before:absolute before:inset-y-0 before:-left-1/3 before:w-1/4 before:-skew-x-12 before:bg-white/25 before:transition-transform before:duration-700 hover:before:translate-x-[600%] motion-reduce:before:hidden',
        className,
      )}
      {...props}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : children}
    </button>
  );
}
