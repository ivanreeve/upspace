'use client';

import { useEffect, useRef } from 'react';

export function AuthProfileSync() {
  const invoked = useRef(false);

  useEffect(() => {
    if (invoked.current) return;
    invoked.current = true;

    const controller = new AbortController();

    fetch('/api/v1/auth/sync-profile', {
      method: 'POST',
      signal: controller.signal,
    }).catch(() => {
      // Silently ignore errors; this request will be retried on navigation.
    });

    return () => {
      controller.abort();
    };
  }, []);

  return null;
}
