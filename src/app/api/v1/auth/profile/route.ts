import { NextResponse } from 'next/server';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ALLOWED_USER_ROLES } from '@/lib/user-roles';

const BIRTHDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const updateProfileSchema = z.object({
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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Failed to read authenticated user in profile route', authError);
      return NextResponse.json(
        { message: 'Unable to verify your session.', },
        { status: 500, }
      );
    }

    const authUser = authData.user;

    if (!authUser) {
      return NextResponse.json(
        { message: 'Authentication required.', },
        { status: 401, }
      );
    }

    const dbUser = await prisma.user.findFirst({
      where: { auth_user_id: authUser.id, },
      select: {
        user_id: true,
        handle: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        avatar: true,
        role: true,
        birthday: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { message: 'Unable to locate user profile.', },
        { status: 404, }
      );
    }

    return NextResponse.json({
      userId: dbUser.user_id.toString(),
      handle: dbUser.handle,
      firstName: dbUser.first_name,
      middleName: dbUser.middle_name,
      lastName: dbUser.last_name,
      avatar: dbUser.avatar,
      role: dbUser.role,
      birthday: dbUser.birthday ? dbUser.birthday.toISOString().slice(0, 10) : null,
    });
  } catch (error) {
    console.error('Unexpected error in profile route', error);
    return NextResponse.json(
      { message: 'Unable to load user profile at the moment.', },
      { status: 500, }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = updateProfileSchema.safeParse(payload);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { message: issue?.message ?? 'Invalid profile payload.', },
        { status: 400, }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Failed to read authenticated user in profile update route', authError);
      return NextResponse.json(
        { message: 'Unable to verify your session.', },
        { status: 500, }
      );
    }

    const authUser = authData.user;

    if (!authUser) {
      return NextResponse.json(
        { message: 'Authentication required.', },
        { status: 401, }
      );
    }

    const birthdayDate = parsed.data.birthday
      ? new Date(`${parsed.data.birthday}T00:00:00Z`)
      : null;

    const updated = await prisma.user.update({
      where: { auth_user_id: authUser.id, },
      data: {
        first_name: parsed.data.firstName,
        middle_name: parsed.data.middleName?.length ? parsed.data.middleName : null,
        last_name: parsed.data.lastName,
        role: parsed.data.role,
        birthday: birthdayDate,
      },
      select: {
        user_id: true,
        handle: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        avatar: true,
        role: true,
        birthday: true,
      },
    }).catch((error) => {
      console.error('Failed to update user profile', error);
      return null;
    });

    if (!updated) {
      return NextResponse.json(
        { message: 'Unable to update your profile right now.', },
        { status: 500, }
      );
    }

    return NextResponse.json({
      userId: updated.user_id.toString(),
      handle: updated.handle,
      firstName: updated.first_name,
      middleName: updated.middle_name,
      lastName: updated.last_name,
      avatar: updated.avatar,
      role: updated.role,
      birthday: updated.birthday ? updated.birthday.toISOString().slice(0, 10) : null,
    });
  } catch (error) {
    console.error('Unexpected error in profile update route', error);
    return NextResponse.json(
      { message: 'Unable to update your profile at the moment.', },
      { status: 500, }
    );
  }
}
