import { NextRequest, NextResponse } from 'next/server';

import { getCustomerBookingDetailRecord } from '@/lib/bookings/detail';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ booking_id: string }> }
) {
  const { booking_id, } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: authData, error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: 'Authentication required.', },
      { status: 401, }
    );
  }

  const user = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!user || user.role !== 'customer') {
    return NextResponse.json(
      { error: 'Insufficient permissions.', },
      { status: 403, }
    );
  }

  if (!booking_id) {
    return NextResponse.json(
      { error: 'Booking not found.', },
      { status: 404, }
    );
  }

  const record = await getCustomerBookingDetailRecord(booking_id, authData.user.id);
  if (!record) {
    return NextResponse.json(
      { error: 'Booking not found.', },
      { status: 404, }
    );
  }

  return NextResponse.json({ data: record, });
}
