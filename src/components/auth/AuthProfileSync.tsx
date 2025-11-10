'use client';

import { useEffect, useRef } from 'react';

import { useSession } from '@/components/auth/SessionProvider';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export function AuthProfileSync() {
  const {
    session, isLoading,
  } = useSession();
  const syncedUserRef = useRef<string | null>(null);
  const authFetch = useAuthenticatedFetch();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === session.user.id) return;

    syncedUserRef.current = session.user.id;
    const controller = new AbortController();
    authFetch('/api/v1/auth/sync-profile', {
      method: 'POST',
      signal: controller.signal,
    }).catch(() => {
    });
    return () => {
      controller.abort();
    };
  }, [authFetch, isLoading, session]);

  return null;
}
