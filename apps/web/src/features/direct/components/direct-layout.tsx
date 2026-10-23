'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Inbox } from './inbox';

// Desktop: the list of chats on the left, the open chat on the right, the whole window tall.
// Tablet and phone (<1280px): one at a time, because two panes leave the chat too narrow — the
// list on /direct/inbox, the open chat with a back button. On a phone the chat is full screen
// over the bars; on a tablet it fills the space beside the sidebar.
export function DirectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname.startsWith('/direct/t/');

  return (
    <div className="flex h-dvh max-md:h-[calc(100dvh-110px)]">
      <aside
        className={cn(
          'w-99.25 shrink-0 border-r border-border/60 max-xl:mx-auto max-xl:w-full max-xl:max-w-160 max-xl:border-r-0',
          inThread && 'max-xl:hidden',
        )}
      >
        <Inbox />
      </aside>
      <div
        className={cn(
          'min-w-0 flex-1',
          inThread
            ? 'max-md:fixed max-md:inset-0 max-md:z-30 max-md:bg-background'
            : 'max-xl:hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}
