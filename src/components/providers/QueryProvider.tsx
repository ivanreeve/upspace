'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children, }: QueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={ client }>{ children }</QueryClientProvider>;
}
