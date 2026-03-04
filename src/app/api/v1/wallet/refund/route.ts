import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createPaymongoRefund } from '@/lib/paymongo';
import { isPaymongoPaymentLinkedToBooking } from '@/lib/paymongo-payment-events';
import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const refundRequestSchema = z.object({
  bookingId: z.string().uuid(),
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
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
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
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    }

    return result;
  }, {});
}

function toSafeMinor(value: bigint | null | undefined) {
  if (typeof value !== 'bigint') {
    return 0;
  }

  const resolved = Number(value);
  return Number.isFinite(resolved) ? resolved : 0;
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
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId, },
      select: {
        id: true,
        partner_auth_id: true,
        price_minor: true,
      },
    });

    if (!booking || booking.partner_auth_id !== auth.dbUser!.auth_user_id) {
      return NextResponse.json(
        { message: 'Booking not found for this partner.', },
        { status: 404, }
      );
    }

    const linkedPayment = await isPaymongoPaymentLinkedToBooking(
      parsed.data.paymentId,
      booking.id
    );
    if (!linkedPayment) {
      return NextResponse.json(
        { message: 'Payment reference is not linked to this booking.', },
        { status: 400, }
      );
    }

    const existing = await prisma.wallet_transaction.findFirst({
      where: {
        wallet_id: walletRow.id,
        booking_id: booking.id,
        type: 'refund',
        status: { in: ['pending', 'succeeded'], },
        metadata: {
          path: ['payment_id'],
          equals: parsed.data.paymentId,
        },
      },
      orderBy: { created_at: 'desc', },
    });

    if (existing) {
      return NextResponse.json({
        transaction: {
          id: existing.id,
          type: existing.type,
          status: existing.status,
          amountMinor: existing.amount_minor.toString(),
          currency: existing.currency,
        },
        refundId: existing.external_reference,
      });
    }

    const paymentTx = await prisma.payment_transaction.findFirst({
      where: {
        booking_id: booking.id,
        provider: 'paymongo',
        status: 'succeeded',
      },
      orderBy: { created_at: 'desc', },
      select: {
        amount_minor: true,
        currency_iso3: true,
      },
    });

    const maxRefundableMinor = paymentTx
      ? toSafeMinor(paymentTx.amount_minor)
      : toSafeMinor(booking.price_minor);

    if (amountMinor > maxRefundableMinor) {
      return NextResponse.json(
        { message: 'Refund amount exceeds the settled booking amount.', },
        { status: 400, }
      );
    }

    const metadata = normalizeMetadata(parsed.data.metadata);
    const createdIntent = await prisma.wallet_transaction.create({
      data: {
        wallet_id: walletRow.id,
        type: 'refund',
        status: 'pending',
        amount_minor: BigInt(amountMinor),
        net_amount_minor: BigInt(amountMinor),
        currency: paymentTx?.currency_iso3 ?? 'PHP',
        description: parsed.data.notes ?? null,
        booking_id: booking.id,
        metadata: {
          ...(metadata ?? {}),
          payment_id: parsed.data.paymentId,
          booking_id: booking.id,
          requested_by: auth.dbUser!.auth_user_id,
        },
      },
    });

    try {
      const refundPayload = await createPaymongoRefund({
        paymentId: parsed.data.paymentId,
        amountMinor,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
        metadata: {
          internal_user_id: auth.dbUser!.user_id.toString(),
          booking_id: booking.id,
          ...(metadata ?? {}),
        },
      });

      const refundAttributes = refundPayload.data.attributes;
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        const updated = await tx.wallet_transaction.update({
          where: { id: createdIntent.id, },
          data: {
            status: refundAttributes.status,
            external_reference: refundPayload.data.id,
            currency: refundAttributes.currency,
            amount_minor: BigInt(refundAttributes.amount),
            net_amount_minor: BigInt(refundAttributes.amount),
            metadata: {
              ...(metadata ?? {}),
              paymongo_refund_id: refundPayload.data.id,
              payment_id: parsed.data.paymentId,
              booking_id: booking.id,
              requested_by: auth.dbUser!.auth_user_id,
            },
            updated_at: new Date(),
          },
        });

        if (refundAttributes.status === 'succeeded') {
          await tx.wallet.update({
            where: { id: walletRow.id, },
            data: {
              balance_minor: { decrement: BigInt(refundAttributes.amount), },
              updated_at: new Date(),
            },
          });
        }

        return updated;
      });

      return NextResponse.json({
        transaction: {
          id: updatedTransaction.id,
          type: updatedTransaction.type,
          status: updatedTransaction.status,
          amountMinor: updatedTransaction.amount_minor.toString(),
          currency: updatedTransaction.currency,
        },
        refundId: refundPayload.data.id,
      });
    } catch (refundError) {
      await prisma.wallet_transaction.update({
        where: { id: createdIntent.id, },
        data: {
          status: 'failed',
          updated_at: new Date(),
        },
      });
      throw refundError;
    }
  } catch (error) {
    console.error('Refund request failed', error);
    return NextResponse.json(
      { message: 'Unable to process refund right now.', },
      { status: 500, }
    );
  }
}
