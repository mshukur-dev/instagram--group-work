'use client';

import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type AuthFieldProps = Omit<React.ComponentProps<'input'>, 'placeholder'> & {
  label: string;
  invalid?: boolean;
};

// The label rests in the middle of the field and floats to the top once there is text or focus.
// A solid 1px border all around: gray at rest, the story-ring gradient while typing, red on error.
// `ref` is a normal prop in React 19, so react-hook-form's register() works through the spread.
export function AuthField({ label, invalid, type, className, id, ...props }: AuthFieldProps) {
  const t = useTranslations('auth');
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <div
      className={cn(
        'group bg-background relative rounded-xl border transition-colors duration-200',
        invalid
          ? 'border-destructive/60'
          : 'border-border hover:border-foreground/25 focus-within:border-story-ring',
        className,
      )}
    >
      <input
        id={id}
        type={isPassword && shown ? 'text' : type}
        placeholder=" "
        aria-invalid={invalid || undefined}
        className="peer h-12 w-full rounded-xl bg-transparent px-3.5 pt-4.5 pr-10 pb-0.5 text-[15px] outline-none"
        {...props}
      />
      <label
        htmlFor={id}
        className={cn(
          // Rests in the middle; on focus or with text it glides up and shrinks. Only transform
          // properties are animated (no font-size or top), so the motion stays smooth.
          'text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 origin-left -translate-y-1/2 text-sm leading-none',
          'transition-[translate,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          'peer-focus:-translate-y-[calc(50%+10px)] peer-focus:scale-[0.82]',
          'peer-[:not(:placeholder-shown)]:-translate-y-[calc(50%+10px)] peer-[:not(:placeholder-shown)]:scale-[0.82]',
        )}
      >
        {label}
      </label>

      <div className="absolute inset-y-0 right-1 flex items-center">
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? t('hide') : t('show')}
            aria-pressed={shown}
            className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-md outline-none focus-visible:text-foreground group-has-[input:placeholder-shown]:hidden"
          >
            {shown ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        ) : invalid ? (
          <CircleAlert aria-hidden="true" className="text-destructive mr-2 size-4.5" />
        ) : null}
      </div>
    </div>
  );
}
