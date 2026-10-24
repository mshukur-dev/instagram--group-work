'use client';

import { useSyncExternalStore } from 'react';

// Installing the site as an app (docs/spec/pwa.md). Chrome and Edge (Android, desktop) fire
// `beforeinstallprompt` once they consider the site installable; we keep the event and show it
// from our own "Install app" button. iPhone Safari has no such event: the user adds the site from
// the Share menu, so for iOS we explain the steps instead.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// At import time, not in an effect: the event can fire before any component mounts
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // our button, not the browser's mini-infobar
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  // The worker (public/sw.js) serves the offline page; push registers the same one, so this repeats
  // harmlessly
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Already running as the installed app (home screen icon, app window). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone / iPad, including iPads that report themselves as a Mac. */
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

type InstallState = 'prompt' | 'ios' | null;

const read = (): InstallState => {
  if (isStandalone()) return null;
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : null;
};

/**
 * How this browser can install the app: `prompt` (the system dialog), `ios` (show the steps)
 * or `null` (already installed, or the browser can't).
 */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, read, () => null);
}

// The iPhone steps sheet lives in Providers, outside the More menu that opens it (the menu closes
// on the first tap elsewhere, which would take a sheet inside it along)
let iosSheetOpen = false;
const sheetListeners = new Set<() => void>();

export function setIosSheetOpen(open: boolean) {
  iosSheetOpen = open;
  sheetListeners.forEach((listener) => listener());
}

export function useIosSheetOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      sheetListeners.add(listener);
      return () => sheetListeners.delete(listener);
    },
    () => iosSheetOpen,
    () => false,
  );
}

/** Opens the system install dialog (Chrome, Edge). */
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null;
  notify();
  await event.prompt();
  await event.userChoice;
}
