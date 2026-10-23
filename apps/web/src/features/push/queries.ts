import { useMutation } from '@tanstack/react-query';
import { enablePush, subscribe } from './push';

/** "Turn on notifications": permission + subscription (PUSH-1) */
export const useEnablePush = () => useMutation({ mutationFn: enablePush });

/** Keeps this browser's subscription saved while notifications are allowed */
export const useSyncPush = () => useMutation({ mutationFn: subscribe });
