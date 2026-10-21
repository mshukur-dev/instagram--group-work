import type { Me } from '@instagram/shared';
import { api } from '@/lib/api';

export const getMe = () => api.get<Me>('/users/me').then((r) => r.data);
