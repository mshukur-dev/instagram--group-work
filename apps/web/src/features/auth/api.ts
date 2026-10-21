import type { LoginInput, Me, RegisterInput } from '@instagram/shared';
import { api } from '@/lib/api';

export const login = (input: LoginInput) => api.post<Me>('/auth/login', input).then((r) => r.data);

export const register = (input: RegisterInput) =>
  api.post<Me>('/auth/register', input).then((r) => r.data);

export const logout = () => api.post('/auth/logout').then(() => undefined);

export const changeUsername = (username: string) =>
  api.patch<Me>('/users/me', { username }).then((r) => r.data);
