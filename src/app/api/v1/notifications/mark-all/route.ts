import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

export async function PATCH() {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const result = await prisma.app_notification.updateMany({
    where: {
      user_auth_id: authData.user.id,
      read_at: null,
    },
    data: { read_at: new Date(), },
  });

  return NextResponse.json({ data: { updatedCount: result.count, }, });
}
