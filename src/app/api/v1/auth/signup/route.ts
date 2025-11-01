import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { z } from 'zod';

import { ensureUserProfile } from '@/lib/auth/user-profile';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Minimum 8 characters.')
    .regex(/[A-Z]/, 'Include at least one uppercase letter.')
    .regex(/[a-z]/, 'Include at least one lowercase letter.')
    .regex(/[0-9]/, 'Include at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.'),
  handle: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._-]+$/i, 'Handle may include letters, numbers, dots, underscores, and dashes.'),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Invalid sign-up payload.',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400, }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const handle = parsed.data.handle.trim().toLowerCase();

  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.error || !created.data?.user) {
      const duplicateErrorCodes = new Set(['email_exists', 'user_already_exists', 'identity_already_exists']);
      const isDuplicate =
        (created.error && duplicateErrorCodes.has(created.error.code ?? '')) ||
        (created.error && created.error.status === 409);

      if (isDuplicate) {
        return NextResponse.json(
          { message: 'An account with this email already exists.', },
          { status: 409, }
        );
      }

      console.error('Supabase failed to create user', created.error);
      return NextResponse.json(
        { message: 'Unable to create user account right now.', },
        { status: 500, }
      );
    }

    const authUserId = created.data.user.id;

    await ensureUserProfile({
      authUserId,
      preferredHandle: handle,
      avatarUrl: created.data.user.user_metadata?.avatar_url ?? null,
      email: created.data.user.email ?? email,
      metadata: created.data.user.user_metadata ?? {},
      strictHandle: true,
    });

    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            try {
              const cookiePayload = {
                name: cookie.name,
                value: cookie.value,
                ...(cookie.options ?? {}),
              };

              cookieStore.set(cookiePayload);
            } catch (error) {
              console.warn('Failed to set Supabase cookie in route handler', error);
            }
          });
        },
      },
    });

    const { error: signInError, } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Failed to establish Supabase session after sign-up', signInError);
    }

    return NextResponse.json({ ok: true, });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { message: 'Handle already in use. Choose a different one.', },
          { status: 409, }
        );
      }
    }

    console.error('Unhandled sign-up error', error);
    return NextResponse.json(
      { message: 'Unable to create user account right now.', },
      { status: 500, }
    );
  }
}
