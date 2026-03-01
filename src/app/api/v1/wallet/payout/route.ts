import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const payoutSchema = z.object({ amountMinor: z.number().int().min(10000, 'Minimum payout is ₱100.'), });

const MIN_BALANCE_FOR_PAYOUT = 10000; // 100 PHP in minor units

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json().catch(() => null);
    const parsed = payoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payout request.', },
        { status: 400, }
      );
    }

    const { amountMinor, } = parsed.data;
    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);

    if (walletRow.balance_minor < BigInt(MIN_BALANCE_FOR_PAYOUT)) {
      return NextResponse.json(
        { error: 'Insufficient wallet balance for a payout.', },
        { status: 400, }
      );
    }

    if (walletRow.balance_minor < BigInt(amountMinor)) {
      return NextResponse.json(
        { error: 'Payout amount exceeds available balance.', },
        { status: 400, }
      );
    }

    const pendingPayout = await prisma.wallet_transaction.findFirst({
      where: {
        wallet_id: walletRow.id,
        type: 'payout',
        status: 'pending',
      },
      select: { id: true, },
    });

    if (pendingPayout) {
      return NextResponse.json(
        { error: 'A payout is already pending. Please wait for it to complete.', },
        { status: 409, }
      );
    }

    const [transaction] = await prisma.$transaction([
      prisma.wallet_transaction.create({
        data: {
          id: randomUUID(),
          wallet_id: walletRow.id,
          type: 'payout',
          status: 'pending',
          amount_minor: BigInt(amountMinor),
          net_amount_minor: BigInt(amountMinor),
          currency: walletRow.currency,
          description: 'Payout request',
          metadata: {
            requested_by: auth.dbUser!.auth_user_id,
            requested_at: new Date().toISOString(),
          },
        },
      }),
      prisma.wallet.update({
        where: { id: walletRow.id, },
        data: { balance_minor: { decrement: BigInt(amountMinor), }, },
      })
    ]);

    return NextResponse.json({
      data: {
        transactionId: transaction.id,
        amountMinor: transaction.amount_minor.toString(),
        currency: transaction.currency,
        status: transaction.status,
      },
    }, { status: 201, });
  } catch (error) {
    console.error('Failed to process payout request', error);
    return NextResponse.json(
      { error: 'Unable to process payout request.', },
      { status: 500, }
    );
  }
}
