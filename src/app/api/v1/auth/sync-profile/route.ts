import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { ensureUserProfile } from '@/lib/auth/user-profile';

export async function POST() {
  try {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return NextResponse.json({ message: 'Server configuration error.', }, { status: 500, });
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

    const {
 data: userData, error: userError, 
} = await supabase.auth.getUser();

    if (userError) {
      console.error('Failed to verify Supabase user in sync-profile route', userError);
      return NextResponse.json({ message: 'Unable to verify session.', }, { status: 500, });
    }

    const user = userData?.user;

    if (!user) {
      return NextResponse.json({ message: 'Not authenticated.', }, { status: 401, });
    }

    await ensureUserProfile({
      authUserId: user.id,
      preferredHandle: null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      email: user.email ?? null,
      metadata: user.user_metadata ?? {},
    });

    return NextResponse.json({ ok: true, });
  } catch (error) {
    console.error('Unhandled sync-profile error', error);
    return NextResponse.json({ message: 'Unable to sync profile right now.', }, { status: 500, });
  }
}
