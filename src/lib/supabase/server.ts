'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return {
 url,
anonKey, 
};
}

/**
 * Mutable Supabase server client for Route Handlers and Server Actions.
 * Token refreshes write updated cookies back to the response.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const {
 url, anonKey, 
} = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          try {
            cookieStore.set({
              name: cookie.name,
              value: cookie.value,
              ...(cookie.options ?? {}),
            });
          } catch {
            // Setting cookies may throw during renders where headers are immutable.
          }
        });
      },
    },
  });
}

/**
 * Read-only Supabase server client for Server Components.
 *
 * `setAll` is a no-op so that a failed token refresh (e.g. when the middleware
 * already consumed the refresh token) cannot clear the auth cookies that the
 * middleware wrote to the response — which would log the user out.
 */
export async function createSupabaseReadOnlyServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const {
 url, anonKey, 
} = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op: Server Components should never write auth cookies.
        // The middleware handles token refresh and cookie propagation.
      },
    },
  });
}
