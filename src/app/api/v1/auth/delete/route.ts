import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DELETION_GRACE_DAYS = 30;
const DELETION_METADATA_KEY = 'deletion_requested_at';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Unable to verify session for deletion', authError);
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

    const existingUser = await prisma.user.findUnique({
      where: { auth_user_id: authUser.id, },
      select: { user_id: true, },
    });

    if (!existingUser) {
      return NextResponse.json(
        { message: 'Unable to locate your profile.', },
        { status: 404, }
      );
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { auth_user_id: authUser.id, },
      data: { is_disabled: true, },
    });

    const metadataPayload = JSON.stringify({ [DELETION_METADATA_KEY]: now.toISOString(), });

    await prisma.$executeRaw`
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || ${metadataPayload}::jsonb
      WHERE id = ${authUser.id}::uuid
    `;

    return NextResponse.json({
      status: 'scheduled',
      reactivationDeadline: deadline.toISOString(),
    });
  } catch (error) {
    console.error('Failed to schedule account deletion', error);
    return NextResponse.json(
      { message: 'Unable to delete your account at the moment.', },
      { status: 500, }
    );
  }
}
