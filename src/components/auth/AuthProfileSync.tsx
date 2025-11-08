'use client';

import { useEffect, useRef } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function AuthProfileSync() {
  const invoked = useRef(false);

  useEffect(() => {
    if (invoked.current) return;
    invoked.current = true;

    const controller = new AbortController();
    const supabase = getSupabaseBrowserClient();
    let isActive = true;

    supabase.auth.getSession()
      .then(({ data, }) => {
        if (!isActive || !data.session) return;

        fetch('/api/v1/auth/sync-profile', {
          method: 'POST',
          signal: controller.signal,
        }).catch(() => {
          // Silently ignore errors; this request will be retried on navigation.
        });
      })
      .catch(() => {
        // Ignore session errors; we simply skip the sync when unauthenticated.
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return null;
}
