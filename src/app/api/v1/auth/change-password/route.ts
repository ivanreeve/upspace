import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[0-9]/, 'Include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, 'Enter your current password.'),
  newPassword: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = changePasswordSchema.safeParse(payload);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { message: issue?.message ?? 'Invalid password payload.', },
        { status: 400, }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Unable to verify user session for password change', authError);
      return NextResponse.json(
        { message: 'Unable to verify your session.', },
        { status: 500, }
      );
    }

    const authUser = authData.user;

    if (!authUser?.email) {
      return NextResponse.json(
        { message: 'Authentication required.', },
        { status: 401, }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error('Missing Supabase config for password change route');
      return NextResponse.json(
        { message: 'Unable to update your password right now.', },
        { status: 500, }
      );
    }

    const verificationClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: verifyError, } = await verificationClient.auth.signInWithPassword({
      email: authUser.email,
      password: parsed.data.currentPassword,
    });

    if (verifyError) {
      const message = verifyError instanceof Error
        ? verifyError.message
        : 'Current password is incorrect.';
      return NextResponse.json(
        { message, },
        { status: 400, }
      );
    }

    const { error: updateError, } = await supabase.auth.updateUser({ password: parsed.data.newPassword, });

    if (updateError) {
      console.error('Failed to change password', updateError);
      return NextResponse.json(
        { message: 'Unable to update your password right now.', },
        { status: 500, }
      );
    }

    return NextResponse.json({ message: 'Password updated.', });
  } catch (error) {
    console.error('Unexpected error changing password', error);
    return NextResponse.json(
      { message: 'Unable to update your password at the moment.', },
      { status: 500, }
    );
  }
}
