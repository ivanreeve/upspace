import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { BookingDetailView } from '@/components/pages/Customer/BookingDetailView';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { normalizeNumeric } from '@/lib/bookings/serializer';
import { buildTimeline } from '@/lib/bookings/timeline';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BookingDetailRecord } from '@/types/booking-detail';

export const metadata: Metadata = {
  title: 'Booking details | UpSpace',
  description: 'View your booking details and payment timeline.',
};

type Props = { params: Promise<{ bookingId: string }> };

export default async function CustomerBookingDetailPage({ params, }: Props) {
  const { bookingId, } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!dbUser || dbUser.role !== 'customer') {
    redirect('/');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId, },
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
    },
  });

  if (!booking || booking.user_auth_id !== authData.user.id) {
    notFound();
  }

  const [paymentTx, refundTxs] = await Promise.all([
    prisma.transaction.findFirst({
      where: { booking_id: booking.id, },
      orderBy: { created_at: 'asc', },
      select: {
        transaction_id: true,
        amount_minor: true,
        fee_minor: true,
        currency_iso3: true,
        payment_method: true,
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
    })
  ]);

  const timeline = buildTimeline(booking, paymentTx, refundTxs);

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
    paymentMethod: paymentTx?.payment_method ?? null,
    isLive: paymentTx?.is_live ?? null,
    timeline,
  };

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <BookingDetailView record={ record } />
    </MarketplaceChrome>
  );
}
