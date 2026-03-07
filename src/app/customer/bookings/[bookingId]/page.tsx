import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { BookingDetailView } from '@/components/pages/Customer/BookingDetailView';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { getCustomerBookingDetailRecord } from '@/lib/bookings/detail';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { prisma } from '@/lib/prisma';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Booking details | UpSpace',
  description: 'View your booking details and payment timeline.',
};

type Props = { params: Promise<{ bookingId: string }> };

export default async function CustomerBookingDetailPage({ params, }: Props) {
  const { bookingId, } = await params;
  const supabase = await createSupabaseReadOnlyServerClient();
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

  const record = await getCustomerBookingDetailRecord(bookingId, authData.user.id);
  if (!record) {
    notFound();
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <BookingDetailView record={ record } />
    </MarketplaceChrome>
  );
}
