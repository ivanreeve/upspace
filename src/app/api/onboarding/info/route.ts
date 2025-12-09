import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureUserProfile } from '@/lib/auth/user-profile';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ALLOWED_USER_ROLES } from '@/lib/user-roles';

const BIRTHDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;


const onboardingSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  role: z.enum(ALLOWED_USER_ROLES),
  birthday: z
    .string()
    .regex(BIRTHDAY_PATTERN, 'Enter your birthday in YYYY-MM-DD format.')
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime());
    }, 'Provide a valid birthday.')
    .optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = onboardingSchema.safeParse(payload);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { message: issue?.message ?? 'Invalid onboarding payload.', },
        { status: 400, }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Failed to read Supabase session in onboarding route', authError);
      return NextResponse.json({ message: 'Unable to verify your session.', }, { status: 500, });
    }

    const authUser = authData.user;
    if (!authUser) {
      return NextResponse.json({ message: 'Authentication required.', }, { status: 401, });
    }

    try {
      await ensureUserProfile({
        authUserId: authUser.id,
        preferredHandle: null,
        avatarUrl: authUser.user_metadata?.avatar_url ?? null,
        email: authUser.email ?? null,
        metadata: authUser.user_metadata ?? {},
      });
    } catch (dbError) {
      console.error('Failed to ensure user profile before onboarding update', dbError);
      return NextResponse.json(
        { message: 'Unable to prepare your profile for onboarding.', },
        { status: 500, }
      );
    }

    const birthdayDate = parsed.data.birthday
      ? new Date(`${parsed.data.birthday}T00:00:00Z`)
      : null;

    try {
      await prisma.user.update({
        where: { auth_user_id: authUser.id, },
        data: {
          first_name: parsed.data.firstName,
          middle_name: parsed.data.middleName?.length ? parsed.data.middleName : null,
          last_name: parsed.data.lastName,
          birthday: birthdayDate,
          role: parsed.data.role,
          is_onboard: true,
        },
      });
    } catch (dbError) {
      console.error('Failed to save onboarding info', dbError);
      return NextResponse.json(
        { message: 'Unable to persist your onboarding information at the moment.', },
        { status: 500, }
      );
    }

    return NextResponse.json({ ok: true, });
  } catch (error) {
    console.error('Unexpected error in onboarding route', error);
    return NextResponse.json(
      { message: 'A server error occurred while saving your onboarding data.', },
      { status: 500, }
    );
  }
}
