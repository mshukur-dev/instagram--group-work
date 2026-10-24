'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';
import { useIsPhone } from '@/lib/use-viewport';

// Short messages at the bottom center ("Link copied", a like that was rolled back). A frosted,
// inverted pill — dark on the light theme, light on the dark one — in the same glass as the post
// menu. Sonner lays toasts out in a column; left/right 0 + mx-auto centre the fit-content pill in
// it. On a phone (Sonner's < 600px layout) its column is 100% wide on top of 16px side offsets,
// i.e. wider than the screen, so the width is reset there. On a phone toasts drop in from the
// top, like system banners, and swipe up to go away (nothing else: sideways stays with the page).
export function Toaster() {
  const isPhone = useIsPhone();
  return (
    <Sonner
      position={isPhone ? 'top-center' : 'bottom-center'}
      swipeDirections={isPhone ? ['top'] : undefined}
      className="max-[600px]:w-auto!"
      offset={isPhone ? { top: 'calc(env(safe-area-inset-top) + 10px)' } : 24}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 10px)', bottom: 72 }}
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
