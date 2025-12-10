import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { CustomerTransactionHistory } from '@/components/pages/Transactions/CustomerTransactionHistory';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CustomerTransactionBookingStatus, CustomerTransactionRecord } from '@/types/transactions';

export const metadata: Metadata = {
  title: 'Transaction history | UpSpace',
  description: 'Review every booking payment you completed in one place.',
};

export default async function CustomerTransactionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      role: true,
    },
  });

  if (!dbUser || dbUser.role !== 'customer') {
    redirect('/');
  }

  const sidebarStateCookies = await cookies();
  const sidebarCookie = sidebarStateCookies.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  const transactionRows = await prisma.transaction.findMany({
    where: { booking: { user_auth_id: authData.user.id, }, },
    include: {
      booking: {
        select: {
          id: true,
          space_name: true,
          area_name: true,
          booking_hours: true,
          created_at: true,
          status: true,
        },
      },
    },
    orderBy: { created_at: 'desc', },
    take: 25,
  });

  const transactions: CustomerTransactionRecord[] = transactionRows.map(
    (row) => {
      const rawHours = row.booking.booking_hours;
      const bookingHours =
        typeof rawHours === 'bigint' ? Number(rawHours) : Number(rawHours);

      return {
        id: row.transaction_id.toString(),
        bookingId: row.booking_id,
        bookingStatus: row.booking.status as CustomerTransactionBookingStatus,
        bookingCreatedAt: row.booking.created_at.toISOString(),
        bookingHours: Number.isFinite(bookingHours) ? bookingHours : 0,
        spaceName: row.booking.space_name,
        areaName: row.booking.area_name,
        currency: row.currency_iso3,
        amountMinor: row.amount_minor?.toString() ?? '0',
        feeMinor: row.fee_minor?.toString() ?? null,
        paymentMethod: row.payment_method,
        isLive: row.is_live,
        transactionCreatedAt: row.created_at.toISOString(),
      };
    }
  );

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <CustomerTransactionHistory transactions={ transactions } />
    </MarketplaceChrome>
  );
}
