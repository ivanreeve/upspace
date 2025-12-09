import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
        status: true,
        pending_deletion_at: true,
        expires_at: true,
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
      status: dbUser.status,
      birthday: dbUser.birthday ? dbUser.birthday.toISOString().slice(0, 10) : null,
      pendingDeletionAt: dbUser.pending_deletion_at
        ? dbUser.pending_deletion_at.toISOString()
        : null,
      expiresAt: dbUser.expires_at ? dbUser.expires_at.toISOString() : null,
    });
    } catch (error) {
      console.error('Unexpected error in profile route', error);
      return NextResponse.json(
        { message: 'Unable to load user profile at the moment.', },
        { status: 500, }
      );
    }
}

const profileUpdateSchema = z.object({
  handle: z.string().trim().min(3).max(50).optional(),
  firstName: z.string().max(50).nullable().optional(),
  middleName: z.string().max(50).nullable().optional(),
  lastName: z.string().max(50).nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function PATCH(req: NextRequest) {
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

    const parsed = profileUpdateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Provide valid profile details.', },
        { status: 400, }
      );
    }

    const {
      handle,
      firstName,
      middleName,
      lastName,
      birthday,
    } = parsed.data;

    if (handle) {
      const conflictingHandle = await prisma.user.findFirst({
        where: {
          handle,
          auth_user_id: { not: authUser.id, },
        },
        select: { user_id: true, },
      });

      if (conflictingHandle) {
        return NextResponse.json(
          { message: 'Handle already taken. Choose another one.', },
          { status: 409, }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { auth_user_id: authUser.id, },
      data: {
        ...(handle ? { handle, } : {}),
        first_name: firstName ?? null,
        middle_name: middleName ?? null,
        last_name: lastName ?? null,
        birthday: birthday ? new Date(birthday) : null,
      },
    });

    return NextResponse.json({
      userId: updatedUser.user_id.toString(),
      handle: updatedUser.handle,
      firstName: updatedUser.first_name,
      middleName: updatedUser.middle_name,
      lastName: updatedUser.last_name,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      birthday: updatedUser.birthday ? updatedUser.birthday.toISOString().slice(0, 10) : null,
    });
  } catch (error) {
    console.error('Unexpected error in profile route', error);
    return NextResponse.json(
      { message: 'Unable to update your profile at the moment.', },
      { status: 500, }
    );
  }
}
