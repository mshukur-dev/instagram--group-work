import { useMemo, useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

// A string snapshot keeps useSyncExternalStore from seeing a new object on every read
const read = () => `${window.innerWidth}x${window.innerHeight}`;

/** Window size; 1280x800 while rendering on the server. */
export function useViewportSize() {
  const snapshot = useSyncExternalStore(subscribe, read, () => '1280x800');
  return useMemo(() => {
    const [width = 1280, height = 800] = snapshot.split('x').map(Number);
    return { width, height };
  }, [snapshot]);
}

/** Phone layout (below Tailwind's md, like the max-md: variants). */
export function useIsPhone() {
  return useViewportSize().width < 768;
}
