'use client';

/**
 * Root client providers.
 *
 * Hosts TanStack Query so every page can use its cache. We instantiate
 * QueryClient inside the component so it lives per-render-tree rather
 * than at module scope (which would be shared across SSR requests).
 *
 * Default cache policy mirrors ARCHITECTURE.md §7: tides 1h, waves
 * 30min, marinas 24h. Per-query options override these.
 */

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Conservative defaults — individual hooks set their own
            // staleTime in line with NFR-004 freshness budgets.
            staleTime: 60_000,
            gcTime: 24 * 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
