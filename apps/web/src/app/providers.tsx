'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/toaster';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
