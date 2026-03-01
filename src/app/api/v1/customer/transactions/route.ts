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
  transaction_id: bigint;
  booking_id: string;
  currency_iso3: string;
  amount_minor: bigint | null;
  fee_minor: bigint | null;
  payment_method: string;
  is_live: boolean;
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

  const transactions = await prisma.transaction.findMany({
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
    take: limit + 1,
    ...(cursor
      ? {
 cursor: { transaction_id: BigInt(cursor), },
skip: 1, 
}
      : {}),
  });

  const hasMore = transactions.length > limit;
  if (hasMore) transactions.pop();

  const nextCursor = hasMore
    ? transactions[transactions.length - 1]?.transaction_id.toString()
    : undefined;

  return NextResponse.json({
    data: transactions.map(mapTransaction),
    pagination: {
 hasMore,
nextCursor, 
},
  });
}
