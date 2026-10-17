'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { patchDomForThirdPartyMutations } from '@/lib/patch-dom';

// Run before any component renders so React's first commit uses the hardened
// removeChild / insertBefore that tolerate third-party DOM mutations (browser
// extensions, Google Maps overlays, dnd portals). This eliminates the
// "Failed to execute 'removeChild' on 'Node'" crash.
patchDomForThirdPartyMutations();

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
