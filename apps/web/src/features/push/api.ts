import { api } from '@/lib/api';

export const getVapidKey = () =>
  api.get<{ key: string }>('/push/vapid-public-key').then((r) => r.data.key);

export const saveSubscription = (subscription: PushSubscriptionJSON) =>
  api.post('/push/subscriptions', subscription).then(() => undefined);

export const removeSubscription = (endpoint: string) =>
  api.delete('/push/subscriptions', { data: { endpoint } }).then(() => undefined);
