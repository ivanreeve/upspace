import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createPaymongoRefund } from '@/lib/paymongo';
import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const refundRequestSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.preprocess((value) => {
    if (typeof value === 'string') {
      return Number(value.trim());
    }

    return value;
  }, z.number().positive('Amount must be greater than zero.')),
  reason: z
    .enum(['duplicate', 'fraudulent', 'requested_by_customer', 'other'])
    .optional(),
  notes: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.bigint()])).optional(),
});

const invalidPayloadResponse = NextResponse.json(
  { message: 'Provide valid refund details.', },
  { status: 400, }
);

function toMinorAmount(amount: number) {
  return Math.round(amount * 100);
}

function normalizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;

  return Object.entries(metadata).reduce<Record<string, string>>((result, [key, value]) => {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      result[key] = String(value);
    }

    return result;
  }, {});
}

export async function POST(req: NextRequest) {
  try {
    const parsed = refundRequestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return invalidPayloadResponse;
    }

    const amountMinor = toMinorAmount(parsed.data.amount);
    if (amountMinor <= 0) {
      return invalidPayloadResponse;
    }

    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);

    const metadata = normalizeMetadata(parsed.data.metadata);
    const refundPayload = await createPaymongoRefund({
      paymentId: parsed.data.paymentId,
      amountMinor,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      metadata: {
        internal_user_id: auth.dbUser!.user_id.toString(),
        ...(metadata ?? {}),
      },
    });

    const refundAttributes = refundPayload.data.attributes;
    const createdTransaction = await prisma.$transaction(async (tx) => {
      const walletTransaction = await tx.wallet_transaction.create({
        data: {
          wallet_id: walletRow.id,
          type: 'refund',
          status: refundAttributes.status,
          amount_minor: BigInt(refundAttributes.amount),
          net_amount_minor: BigInt(refundAttributes.amount),
          currency: refundAttributes.currency,
          description: refundAttributes.notes ?? parsed.data.notes ?? null,
          external_reference: refundPayload.data.id,
          metadata: metadata
            ? {
                ...metadata,
                paymongo_refund_id: refundPayload.data.id,
              }
            : { paymongo_refund_id: refundPayload.data.id, },
        },
      });

      if (refundAttributes.status === 'succeeded') {
        await tx.wallet.update({
          where: { id: walletRow.id, },
          data: {
            balance_minor: { increment: BigInt(refundAttributes.amount), },
            updated_at: new Date(),
          },
        });
      }

      return walletTransaction;
    });

    return NextResponse.json({
      transaction: {
        id: createdTransaction.id,
        type: createdTransaction.type,
        status: createdTransaction.status,
        amountMinor: createdTransaction.amount_minor.toString(),
        currency: createdTransaction.currency,
      },
      refundId: refundPayload.data.id,
    });
  } catch (error) {
    console.error('Refund request failed', error);
    return NextResponse.json(
      { message: 'Unable to process refund right now.', },
      { status: 500, }
    );
  }
}
