'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Inbox } from './inbox';

// Desktop: the list of chats on the left, the open chat on the right, the whole window tall.
// Phone: one at a time — the list on /direct/inbox, the chat full screen over the bars.
export function DirectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname.startsWith('/direct/t/');

  return (
    <div className="flex h-dvh max-md:h-[calc(100dvh-110px)]">
      <aside
        className={cn(
          'w-[397px] shrink-0 border-r border-border/60 max-xl:w-[340px] max-md:w-full max-md:border-r-0',
          inThread && 'max-md:hidden',
        )}
      >
        <Inbox />
      </aside>
      <div
        className={cn(
          'min-w-0 flex-1',
          inThread
            ? 'max-md:fixed max-md:inset-0 max-md:z-30 max-md:bg-background'
            : 'max-md:hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}
