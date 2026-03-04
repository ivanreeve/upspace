import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CustomerTransactionBookingStatus, CustomerTransactionRecord } from '@/types/transactions';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function mapTransaction(row: {
  id: string;
  booking_id: string | null;
  currency_iso3: string;
  amount_minor: bigint;
  fee_minor: bigint | null;
  provider: string;
  is_live: boolean;
  occurred_at: Date | null;
  created_at: Date;
  booking: {
    id: string;
    space_name: string;
    area_name: string;
    booking_hours: unknown;
    created_at: Date;
    status: string;
  };
}): CustomerTransactionRecord {
  const rawHours = row.booking.booking_hours;
  const bookingHours = typeof rawHours === 'bigint' ? Number(rawHours) : Number(rawHours);
  const transactionTimestamp = row.occurred_at ?? row.created_at;

  return {
    id: row.id,
    bookingId: row.booking_id ?? row.booking.id,
    bookingStatus: row.booking.status as CustomerTransactionBookingStatus,
    bookingCreatedAt: row.booking.created_at.toISOString(),
    bookingHours: Number.isFinite(bookingHours) ? bookingHours : 0,
    spaceName: row.booking.space_name,
    areaName: row.booking.area_name,
    currency: row.currency_iso3,
    amountMinor: row.amount_minor.toString(),
    feeMinor: row.fee_minor?.toString() ?? null,
    paymentMethod: row.provider,
    isLive: row.is_live,
    transactionCreatedAt: transactionTimestamp.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
 data: authData, error: authError, 
} = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
 user_id: true,
role: true, 
},
  });

  if (!dbUser || dbUser.role !== 'customer') {
    return forbiddenResponse;
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters.', }, { status: 400, });
  }

  const {
 cursor, limit, 
} = parsed.data;

  const transactions = await prisma.payment_transaction.findMany({
    where: {
      status: 'succeeded',
      booking: { user_auth_id: authData.user.id, },
    },
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
    take: limit + 1,
    ...(cursor
      ? {
 cursor: { id: cursor, },
skip: 1, 
}
      : {}),
  });

  const hasMore = transactions.length > limit;
  if (hasMore) transactions.pop();

  const nextCursor = hasMore
    ? transactions[transactions.length - 1]?.id
    : undefined;

  const transactionsWithBooking = transactions.filter(
    (
      transaction
    ): transaction is typeof transaction & {
      booking: NonNullable<typeof transaction.booking>;
    } => transaction.booking !== null
  );

  return NextResponse.json({
    data: transactionsWithBooking.map(mapTransaction),
    pagination: {
 hasMore,
nextCursor, 
},
  });
}
