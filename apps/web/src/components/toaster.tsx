'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

// Short messages at the bottom center ("Link copied", a like that was rolled back). A frosted,
// inverted pill — dark on the light theme, light on the dark one — in the same glass as the post
// menu. Sonner lays toasts out in a column; left/right 0 + mx-auto centre the fit-content pill in
// it. On a phone (Sonner's < 600px layout) its column is 100% wide on top of 16px side offsets,
// i.e. wider than the screen, so the width is reset there; the pill sits above the bottom bar.
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      className="max-[600px]:w-auto!"
      // right: the message cards (bottom-right) keep clear of the theme button in the corner
      offset={{ bottom: 24, right: 84 }}
      mobileOffset={{ bottom: 72 }}
      icons={{
        success: <CircleCheck className="size-4.5" />,
        error: <CircleAlert className="size-4.5" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'left-0 right-0 mx-auto flex w-fit! max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-background/10 bg-foreground/85 px-4 py-2.5 text-sm font-medium text-background shadow-float-raised backdrop-blur-xl backdrop-saturate-150',
          icon: 'flex shrink-0 items-center',
          error: 'text-background **:data-icon:text-destructive',
        },
      }}
    />
  );
}
