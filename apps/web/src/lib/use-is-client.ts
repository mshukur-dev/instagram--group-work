import { useSyncExternalStore } from 'react';

const noop = () => () => undefined;

/** False while rendering on the server and hydrating, true after: portals into body need it. */
export const useIsClient = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
