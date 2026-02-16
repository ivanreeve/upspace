import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { wallet, wallet_transaction } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const walletQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(['cash_in', 'charge', 'refund', 'payout']).optional(),
  status: z.enum(['pending', 'succeeded', 'failed']).optional(),
});

function mapWallet(walletRow: wallet) {
  return {
    id: walletRow.id,
    balanceMinor: walletRow.balance_minor.toString(),
    currency: walletRow.currency,
    createdAt: walletRow.created_at.toISOString(),
    updatedAt: (walletRow.updated_at ?? walletRow.created_at).toISOString(),
  };
}

function mapWalletTransaction(transaction: wallet_transaction) {
  return {
    id: transaction.id,
    walletId: transaction.wallet_id,
    type: transaction.type,
    status: transaction.status,
    amountMinor: transaction.amount_minor.toString(),
    netAmountMinor: transaction.net_amount_minor?.toString() ?? null,
    currency: transaction.currency,
    description: transaction.description,
    bookingId: transaction.booking_id,
    externalReference: transaction.external_reference,
    metadata: transaction.metadata ?? null,
    createdAt: transaction.created_at.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = walletQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid query parameters.', },
        { status: 400, }
      );
    }

    const {
 cursor, limit, type, status, 
} = parsed.data;
    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);

    const transactionWhere: Record<string, unknown> = { wallet_id: walletRow.id, };
    if (type) transactionWhere.type = type;
    if (status) transactionWhere.status = status;

    const [transactions, chargeAgg, refundAgg, filteredCount] = await Promise.all([
      prisma.wallet_transaction.findMany({
        where: transactionWhere,
        orderBy: { created_at: 'desc', },
        take: limit + 1,
        ...(cursor
          ? {
 cursor: { id: cursor, },
skip: 1, 
}
          : {}),
      }),
      prisma.wallet_transaction.aggregate({
        where: {
 wallet_id: walletRow.id,
type: 'charge',
status: 'succeeded', 
},
        _sum: { amount_minor: true, },
      }),
      prisma.wallet_transaction.aggregate({
        where: {
 wallet_id: walletRow.id,
type: 'refund',
status: 'succeeded', 
},
        _sum: { amount_minor: true, },
      }),
      prisma.wallet_transaction.count({ where: transactionWhere, })
    ]);

    const hasMore = transactions.length > limit;
    if (hasMore) transactions.pop();

    const nextCursor = hasMore ? transactions[transactions.length - 1]?.id : undefined;

    return NextResponse.json({
      wallet: mapWallet(walletRow),
      transactions: transactions.map(mapWalletTransaction),
      pagination: {
 hasMore,
nextCursor, 
},
      stats: {
        totalEarnedMinor: (chargeAgg._sum.amount_minor ?? BigInt(0)).toString(),
        totalRefundedMinor: (refundAgg._sum.amount_minor ?? BigInt(0)).toString(),
        transactionCount: filteredCount,
      },
    });
  } catch (error) {
    console.error('Failed to load wallet data', error);
    return NextResponse.json(
      { message: 'Unable to load wallet information right now.', },
      { status: 500, }
    );
  }
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { message: 'Top-ups are disabled. Wallet receives funds only from bookings.', },
    { status: 405, }
  );
}
