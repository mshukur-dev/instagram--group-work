import { QueryClient, isServer } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying 401 is pointless: the user has to log in
        retry: (failureCount, error) =>
          !(isAxiosError(error) && error.response?.status === 401) && failureCount < 2,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One client per request on the server, one shared client in the browser (the Axios interceptor needs it too). */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  return (browserClient ??= makeQueryClient());
}
