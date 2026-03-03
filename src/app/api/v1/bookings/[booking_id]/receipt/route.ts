import { NextRequest, NextResponse } from 'next/server';

import { normalizeNumeric } from '@/lib/bookings/serializer';
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
    select: {
 role: true,
first_name: true,
last_name: true,
handle: true,
},
  });

  if (!user || user.role !== 'customer') {
    return NextResponse.json(
      { error: 'Insufficient permissions.', },
      { status: 403, }
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
      expires_at: true,
      guest_count: true,
      price_minor: true,
      currency: true,
      status: true,
      created_at: true,
      user_auth_id: true,
      price_rule_name: true,
    },
  });

  if (!booking || booking.user_auth_id !== authData.user.id) {
    return NextResponse.json(
      { error: 'Booking not found.', },
      { status: 404, }
    );
  }

  if (!['confirmed', 'checkedin', 'checkedout', 'completed'].includes(booking.status)) {
    return NextResponse.json(
      { error: 'Receipt is only available for confirmed bookings.', },
      { status: 400, }
    );
  }

  const paymentTx = await prisma.payment_transaction.findFirst({
    where: { booking_id: booking.id, },
    orderBy: { created_at: 'asc', },
    select: {
      id: true,
      amount_minor: true,
      currency_iso3: true,
      provider: true,
      created_at: true,
    },
  });

  const priceMinor = normalizeNumeric(booking.price_minor);

  return NextResponse.json({
    data: {
      bookingId: booking.id,
      spaceName: booking.space_name,
      areaName: booking.area_name,
      bookingHours: normalizeNumeric(booking.booking_hours) ?? 0,
      startAt: booking.start_at.toISOString(),
      expiresAt: booking.expires_at?.toISOString() ?? null,
      guestCount: booking.guest_count,
      priceMinor: priceMinor?.toString() ?? null,
      currency: booking.currency,
      status: booking.status,
      createdAt: booking.created_at.toISOString(),
      customerName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.handle || 'Guest',
      pricingRuleName: booking.price_rule_name ?? null,
      payment: paymentTx
        ? {
            transactionId: paymentTx.id,
            amountMinor: (paymentTx.amount_minor ?? BigInt(0)).toString(),
            currency: paymentTx.currency_iso3,
            method: paymentTx.provider ?? null,
            paidAt: paymentTx.created_at.toISOString(),
          }
        : null,
    },
  });
}
