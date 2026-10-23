import { getVapidKey, removeSubscription, saveSubscription } from './api';

// Web Push in the browser (docs/spec/push.md §2): the service worker, the permission and the
// subscription the API sends to.

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const registerWorker = () => navigator.serviceWorker.register('/sw.js');

// The VAPID key comes as base64url; the browser wants raw bytes
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** This browser's subscription, created if needed, saved on the server (safe to repeat). */
export async function subscribe(): Promise<void> {
  const registration = await registerWorker();
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const key = await getVapidKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    });
  }
  await saveSubscription(subscription.toJSON());
}

/** Asks for permission (must follow a click) and subscribes. True when notifications are on. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  await subscribe();
  return true;
}

/** On log out: this browser stops getting the account's pushes. */
export async function disablePushHere(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await removeSubscription(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}
