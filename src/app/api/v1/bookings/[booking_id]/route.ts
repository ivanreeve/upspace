import { NextRequest, NextResponse } from 'next/server';

import { normalizeNumeric } from '@/lib/bookings/serializer';
import { buildTimeline } from '@/lib/bookings/timeline';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BookingDetailRecord } from '@/types/booking-detail';

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

  const booking = await prisma.booking.findUnique({
    where: { id: booking_id, },
    select: {
      id: true,
      space_id: true,
      space_name: true,
      area_id: true,
      area_name: true,
      booking_hours: true,
      start_at: true,
      guest_count: true,
      price_minor: true,
      currency: true,
      status: true,
      created_at: true,
      user_auth_id: true,
      expires_at: true,
    },
  });

  if (!booking || booking.user_auth_id !== authData.user.id) {
    return NextResponse.json(
      { error: 'Booking not found.', },
      { status: 404, }
    );
  }

  const [paymentTx, refundTxs, statusNotifications] = await Promise.all([
    prisma.payment_transaction.findFirst({
      where: { booking_id: booking.id, },
      orderBy: { created_at: 'asc', },
      select: {
        id: true,
        amount_minor: true,
        fee_minor: true,
        currency_iso3: true,
        provider: true,
        is_live: true,
        created_at: true,
      },
    }),
    prisma.wallet_transaction.findMany({
      where: {
 booking_id: booking.id,
type: 'refund',
},
      orderBy: { created_at: 'asc', },
      select: {
        id: true,
        status: true,
        amount_minor: true,
        currency: true,
        created_at: true,
      },
    }),
    prisma.app_notification.findMany({
      where: {
        booking_id: booking.id,
        user_auth_id: authData.user.id,
        type: { in: ['booking_confirmed', 'system'], },
      },
      orderBy: { created_at: 'asc', },
      select: {
 type: true,
title: true,
created_at: true, 
},
    })
  ]);

  const timeline = buildTimeline(booking, paymentTx, refundTxs, statusNotifications);

  const record: BookingDetailRecord = {
    id: booking.id,
    spaceId: booking.space_id,
    spaceName: booking.space_name,
    areaId: booking.area_id,
    areaName: booking.area_name,
    bookingHours: normalizeNumeric(booking.booking_hours) ?? 0,
    startAt: booking.start_at.toISOString(),
    guestCount: booking.guest_count,
    priceMinor: booking.price_minor?.toString() ?? null,
    currency: booking.currency,
    status: booking.status,
    createdAt: booking.created_at.toISOString(),
    paymentMethod: paymentTx?.provider ?? null,
    isLive: paymentTx?.is_live ?? null,
    timeline,
  };

  return NextResponse.json({ data: record, });
}
