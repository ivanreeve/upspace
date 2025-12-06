import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { user_status } from '@prisma/client';

import { ensureUserProfile } from '@/lib/auth/user-profile';
import { prisma } from '@/lib/prisma';

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

    const now = new Date();
    const dbUser = await prisma.user.findFirst({
      where: { auth_user_id: user.id, },
      select: {
        status: true,
        expires_at: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ message: 'User profile not found.', }, { status: 404, });
    }

    if (dbUser.status === user_status.deleted) {
      return NextResponse.json({ message: 'Account deleted.', }, { status: 403, });
    }

    if (dbUser.status === user_status.pending_deletion) {
      const expiresAt = dbUser.expires_at ? new Date(dbUser.expires_at) : null;
      if (expiresAt && expiresAt.getTime() <= now.getTime()) {
        await prisma.user.update({
          where: { auth_user_id: user.id, },
          data: {
            status: user_status.deleted,
            deleted_at: now,
          },
        });
        return NextResponse.json({ message: 'Account deleted.', }, { status: 403, });
      }
    }

    return NextResponse.json({ ok: true, });
  } catch (error) {
    console.error('Unhandled sync-profile error', error);
    return NextResponse.json({ message: 'Unable to sync profile right now.', }, { status: 500, });
  }
}
