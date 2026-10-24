/* global self, fetch, URL, caches, Response */
/* Service worker for Web Push (docs/spec/push.md §5) and the installed app (docs/spec/pwa.md).
 * The browser keeps it running in the background, so notifications arrive with the tab closed.
 * Plain JS: it is served as is from /sw.js, outside the Next.js build. */

// Only the offline page is cached: everything else always comes from the network
const CACHE = 'offline-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// A page that can't load without the network gets the offline page instead of the browser's error
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((page) => page || Response.error()),
    ),
  );
});

// The offline page's own icon, also while offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname !== '/icons/icon-192.png') return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});

// The action buttons are drawn by the system, so they follow the browser's language
const ru = (self.navigator.language || '').toLowerCase().startsWith('ru');
const LABELS = ru
  ? { accept: 'Принять', decline: 'Отклонить' }
  : { accept: 'Accept', decline: 'Decline' };

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(show(data));
});

async function show(data) {
  // The call was answered elsewhere or ended: take the ringing notification away
  if (data.type === 'CALL_ENDED') {
    const open = await self.registration.getNotifications({ tag: data.tag });
    open.forEach((n) => n.close());
    return;
  }
  const isCall = data.type === 'CALL';
  await self.registration.showNotification(data.title || 'Instagram', {
    body: data.body,
    icon: data.icon || undefined,
    // Same tag replaces the previous one: a chat's new messages update one notification
    tag: data.tag,
    renotify: true,
    data,
    // A call stays until answered; it buzzes like a phone
    requireInteraction: isCall,
    vibrate: isCall ? [400, 200, 400, 200, 400] : [120],
    actions: isCall
      ? [
          { action: 'accept', title: LABELS.accept },
          { action: 'decline', title: LABELS.decline },
        ]
      : [],
  });
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  if (event.action === 'decline' && data.callId) {
    event.waitUntil(decline(data.callId));
    return;
  }
  // Accept, or a tap on the notification itself: open the chat (a call's url joins it)
  event.waitUntil(openApp(data.url || '/'));
});

/** POST decline; after a long-closed tab the access token is stale: refresh once and retry. */
async function decline(callId) {
  const send = () =>
    fetch(`/api/calls/${callId}/decline`, { method: 'POST', credentials: 'include' });
  const res = await send();
  if (res.status !== 401) return;
  const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (refreshed.ok) await send();
}

/** An open tab of the site goes to the url (without reloading), or a new tab opens it. */
async function openApp(url) {
  const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const tab = tabs.find((c) => new URL(c.url).origin === self.location.origin);
  if (tab) {
    tab.postMessage({ type: 'open', url });
    return tab.focus();
  }
  return self.clients.openWindow(url);
}
