import { NextRequest, NextResponse } from 'next/server';
import type { wallet, wallet_transaction } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const walletTopUpSchema = z.object({
  amount: z.preprocess(
    (value) => {
      if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          return NaN;
        }
        return Number(normalized);
      }

      return value;
    },
    z
      .number()
      .positive('Amount should be greater than zero.')
      .max(1_000_000, 'Amount exceeds the current top-up limit.')
  ),
});

const unauthorizedResponse = NextResponse.json(
  { message: 'Authentication required.', },
  { status: 401, }
);

const invalidPayloadResponse = NextResponse.json(
  { message: 'Provide a valid amount to top up your wallet.', },
  { status: 400, }
);

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
    const auth = await resolveAuthenticatedUserForWallet();
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

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUserForWallet();
    if (auth.response) {
      return auth.response;
    }

    const parsed = walletTopUpSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return invalidPayloadResponse;
    }

    const amountMinor = Math.round(parsed.data.amount * 100);
    if (amountMinor <= 0) {
      return invalidPayloadResponse;
    }

    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);

    const transactionResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: walletRow.id, },
        data: {
          balance_minor: { increment: amountMinor, },
          updated_at: new Date(),
        },
      });

      const transactionRow = await tx.wallet_transaction.create({
        data: {
          wallet_id: walletRow.id,
          type: 'cash_in',
          status: 'succeeded',
          amount_minor: amountMinor,
          net_amount_minor: amountMinor,
          currency: walletRow.currency,
          description: 'Top-up via PayMongo wallet',
          metadata: {
            channel: 'web',
            requested_amount: parsed.data.amount,
          },
        },
      });

      return {
        updatedWallet,
        transactionRow,
      };
    });

    return NextResponse.json(
      {
        wallet: mapWallet(transactionResult.updatedWallet),
        transaction: mapWalletTransaction(transactionResult.transactionRow),
      },
      { status: 201, }
    );
  } catch (error) {
    console.error('Failed to top up wallet', error);
    return NextResponse.json(
      { message: 'Unable to top up your wallet right now.', },
      { status: 500, }
    );
  }
}
