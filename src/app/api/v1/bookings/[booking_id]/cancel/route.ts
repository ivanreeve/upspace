import { NextRequest, NextResponse } from 'next/server';

import { BookingStatus } from '@/lib/bookings/types';
import { mapBookingsWithProfiles } from '@/lib/bookings/serializer';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Booking not found.', },
  { status: 404, }
);

const invalidStatusResponse = (message: string) =>
  NextResponse.json({ error: message, }, { status: 400, });

const CANCELLABLE_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed'
];

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ booking_id: string }> }
) {
  const params = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
 data: authData, error: authError, 
} = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const user = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!user || user.role !== 'customer') {
    return forbiddenResponse;
  }

  const { booking_id, } = params;
  if (!booking_id) {
    return notFoundResponse;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: booking_id, },
    select: {
      id: true,
      space_id: true,
      space_name: true,
      area_id: true,
      area_name: true,
      booking_hours: true,
      price_minor: true,
      currency: true,
      status: true,
      created_at: true,
      user_auth_id: true,
      partner_auth_id: true,
      area_max_capacity: true,
    },
  });

  if (!booking || booking.user_auth_id !== authData.user.id) {
    return notFoundResponse;
  }

  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    return invalidStatusResponse('This booking cannot be cancelled at this time.');
  }

  await prisma.booking.update({
    where: { id: booking.id, },
    data: { status: 'cancelled', },
  });

  const updatedRows = await prisma.booking.findMany({ where: { id: booking.id, }, });
  const [record] = await mapBookingsWithProfiles(updatedRows);

  if (!record) {
    return notFoundResponse;
  }

  return NextResponse.json({ data: record, });
}
