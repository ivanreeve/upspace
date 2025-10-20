'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

let client: QueryClient | null = null;

function getClient() {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 5 * 60_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
  }
  return client;
}

export default function QueryProvider({ children, }: { children: React.ReactNode }) {
  return <QueryClientProvider client={ getClient() }>{ children }</QueryClientProvider>;
}

