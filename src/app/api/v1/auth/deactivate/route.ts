import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEACTIVATION_METADATA_KEY = 'deactivation_requested_at';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Unable to verify session for deactivation', authError);
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

    await prisma.user.update({
      where: { auth_user_id: authUser.id, },
      data: { is_disabled: true, },
    });

    const metadataPayload = JSON.stringify({ [DEACTIVATION_METADATA_KEY]: new Date().toISOString(), });

    await prisma.$executeRaw`
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || ${metadataPayload}::jsonb
      WHERE id = ${authUser.id}::uuid
    `;

    return NextResponse.json({ status: 'deactivated', });
  } catch (error) {
    console.error('Failed to deactivate account', error);
    return NextResponse.json(
      { message: 'Unable to deactivate your account at the moment.', },
      { status: 500, }
    );
  }
}
