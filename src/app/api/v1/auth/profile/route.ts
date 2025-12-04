import { NextResponse } from 'next/server';

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
