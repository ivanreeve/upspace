'use client';

import { useCallback } from 'react';

import { useSession } from '@/components/auth/SessionProvider';

export function useAuthenticatedFetch() {
  const { accessToken, } = useSession();

  return useCallback(<T = Response>(input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return fetch(input, {
      ...init,
      headers,
    }) as Promise<T>;
  }, [accessToken]);
}
