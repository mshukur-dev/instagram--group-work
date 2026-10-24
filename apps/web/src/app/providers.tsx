'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/toaster';
import { getQueryClient } from '@/lib/query-client';
// Imported on every page, the login one too: Chrome offers installation once per page load
import { IosInstallSheetHost } from '@/features/pwa/components/ios-install-sheet';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      <Toaster />
      <IosInstallSheetHost />
    </QueryClientProvider>
  );
}
