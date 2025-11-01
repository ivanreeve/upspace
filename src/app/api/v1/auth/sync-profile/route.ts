import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { ensureUserProfile } from '@/lib/auth/user-profile';

export async function POST() {
  try {
    const cookieStore = cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
    }

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            cookieStore.set({
              name: cookie.name,
              value: cookie.value,
              ...(cookie.options ?? {}),
            });
          });
        },
      },
    });

    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Failed to read Supabase session in sync-profile route', sessionError);
      return NextResponse.json({ message: 'Unable to verify session.' }, { status: 500 });
    }

    const session = data.session;

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });
    }

    await ensureUserProfile({
      authUserId: session.user.id,
      preferredHandle: null,
      avatarUrl: session.user.user_metadata?.avatar_url ?? null,
      email: session.user.email ?? null,
      metadata: session.user.user_metadata ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unhandled sync-profile error', error);
    return NextResponse.json({ message: 'Unable to sync profile right now.' }, { status: 500 });
  }
}
