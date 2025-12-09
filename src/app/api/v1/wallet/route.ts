import { NextRequest, NextResponse } from 'next/server';
import type { wallet, wallet_transaction } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

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

export async function GET() {
  try {
    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);
    const transactions = await prisma.wallet_transaction.findMany({
      where: { wallet_id: walletRow.id, },
      orderBy: { created_at: 'desc', },
      take: 25,
    });

    return NextResponse.json({
      wallet: mapWallet(walletRow),
      transactions: transactions.map(mapWalletTransaction),
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
