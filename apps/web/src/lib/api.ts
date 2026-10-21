import axios from 'axios';

// Same-origin requests: Next.js rewrites /api/* to the NestJS API.
// TODO(auth): 401 → refresh → retry interceptor (docs/spec/frontend.md, participant 1)
export const api = axios.create({ baseURL: '/api', withCredentials: true });
