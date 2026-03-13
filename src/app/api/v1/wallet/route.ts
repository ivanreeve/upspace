import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { wallet, wallet_transaction } from '@prisma/client';

import { getPartnerProviderAccountView } from '@/lib/financial/provider-accounts';
import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const booleanQueryParamSchema = z.preprocess((value) => {
  if (value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') {
      return true;
    }

    if (normalized === '0' || normalized === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean());

const walletQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(['cash_in', 'charge', 'refund', 'payout']).optional(),
  status: z.enum(['pending', 'succeeded', 'failed']).optional(),
  includeProvider: booleanQueryParamSchema,
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

function sanitizeWalletTransactionMetadata(metadata: wallet_transaction['metadata']) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return metadata ?? null;
  }

  const sanitized = { ...metadata, };
  delete sanitized.payout_destination_encrypted;

  return sanitized;
}

function mapWalletTransaction(
  transaction: wallet_transaction,
  bookingLookup: Map<string, { space_name: string; area_name: string }>
) {
  const bookingId = transaction.booking_id ?? null;
  const bookingInfo = bookingId ? bookingLookup.get(bookingId) ?? null : null;
  return {
    id: transaction.id,
    walletId: transaction.wallet_id,
    type: transaction.type,
    status: transaction.status,
    amountMinor: transaction.amount_minor.toString(),
    netAmountMinor: transaction.net_amount_minor?.toString() ?? null,
    currency: transaction.currency,
    description: transaction.description,
    bookingId,
    processedAt: transaction.processed_at?.toISOString() ?? null,
    resolutionNote: transaction.resolution_note,
    booking: bookingInfo
      ? {
        id: bookingId ?? '',
        spaceName: bookingInfo.space_name,
        areaName: bookingInfo.area_name,
      }
      : null,
    externalReference: transaction.external_reference,
    metadata: sanitizeWalletTransactionMetadata(transaction.metadata),
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
 cursor, includeProvider, limit, type, status, 
} = parsed.data;
    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);

    const transactionWhere: Record<string, unknown> = { wallet_id: walletRow.id, };
    if (type) transactionWhere.type = type;
    if (status) transactionWhere.status = status;

    const [providerAccount, transactions, chargeAgg, refundAgg, pendingPayoutAgg, paidOutAgg, filteredCount] = await Promise.all([
      includeProvider
        ? getPartnerProviderAccountView({ partnerUserId: auth.dbUser!.user_id, })
        : Promise.resolve(null),
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
      prisma.wallet_transaction.aggregate({
        where: {
          wallet_id: walletRow.id,
          type: 'payout',
          status: 'pending',
        },
        _sum: { amount_minor: true, },
      }),
      prisma.wallet_transaction.aggregate({
        where: {
          wallet_id: walletRow.id,
          type: 'payout',
          status: 'succeeded',
        },
        _sum: { amount_minor: true, },
      }),
      prisma.wallet_transaction.count({ where: transactionWhere, })
    ]);
    const resolvedWalletRow = includeProvider
      ? await prisma.wallet.findUnique({ where: { id: walletRow.id, }, }) ?? walletRow
      : walletRow;

    const bookingIds = Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.booking_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const bookingRows = bookingIds.length
      ? await prisma.booking.findMany({
        where: { id: { in: bookingIds, }, },
        select: {
 id: true,
space_name: true,
area_name: true, 
},
      })
      : [];

    const bookingLookup = new Map(
      bookingRows.map((row) => [
        row.id,
        {
 space_name: row.space_name,
area_name: row.area_name, 
}
      ])
    );

    const hasMore = transactions.length > limit;
    if (hasMore) transactions.pop();

    const nextCursor = hasMore ? transactions[transactions.length - 1]?.id : undefined;

    return NextResponse.json({
      wallet: mapWallet(resolvedWalletRow),
      providerAccount,
      transactions: transactions.map((transaction) =>
        mapWalletTransaction(transaction, bookingLookup)
      ),
      pagination: {
 hasMore,
nextCursor, 
},
      stats: {
        totalEarnedMinor: (chargeAgg._sum.amount_minor ?? BigInt(0)).toString(),
        totalRefundedMinor: (refundAgg._sum.amount_minor ?? BigInt(0)).toString(),
        pendingPayoutMinor: (pendingPayoutAgg._sum.amount_minor ?? BigInt(0)).toString(),
        totalPaidOutMinor: (paidOutAgg._sum.amount_minor ?? BigInt(0)).toString(),
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
