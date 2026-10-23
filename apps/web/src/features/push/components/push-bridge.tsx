'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/features/profile/queries';
import { pushSupported, registerWorker } from '../push';
import { useSyncPush } from '../queries';

const TITLE_COUNT = /^\(\d+\)\s/;

// Mounted once in the main layout. Registers the service worker, re-saves the subscription
// when notifications are already allowed, opens what a clicked notification points to in this
// tab, and shows unread chats + notifications in the tab title: "(3) Instagram" (PUSH-6).
export function PushBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();
  const sync = useSyncPush().mutate;
  const meId = me?.id;

  useEffect(() => {
    if (!meId || !pushSupported()) return;
    void registerWorker().catch(() => undefined);
    if (Notification.permission === 'granted') sync();
  }, [meId, sync]);

  // The service worker asks an open tab to go somewhere instead of opening a new one
  useEffect(() => {
    if (!pushSupported()) return;
    const onMessage = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === 'open' && event.data.url) router.push(event.data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);

  const unread = (me?.unreadConversationsCount ?? 0) + (me?.unreadNotificationsCount ?? 0);
  useEffect(() => {
    // Pages set their own titles; this only adds or updates the count in front
    const apply = () => {
      const base = document.title.replace(TITLE_COUNT, '');
      const next = unread > 0 ? `(${unread}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const title = document.querySelector('title');
    if (!title) return;
    const observer = new MutationObserver(apply);
    observer.observe(title, { childList: true });
    return () => observer.disconnect();
  }, [unread, pathname]);

  return null;
}
