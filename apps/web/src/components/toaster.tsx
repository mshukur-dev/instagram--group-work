'use client';

import { Toaster as Sonner } from 'sonner';

// Short messages at the bottom center (errors that would otherwise pass unnoticed, e.g. a like
// that was rolled back). Inverted pill: dark on the light theme, light on the dark one.
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={24}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-float-raised',
        },
      }}
    />
  );
}
