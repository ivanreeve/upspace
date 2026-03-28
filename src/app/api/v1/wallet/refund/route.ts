import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { submitXenditRefund } from '@/lib/financial/xendit-refunds';
import { prisma } from '@/lib/prisma';
import { FinancialProviderError } from '@/lib/providers/errors';
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

    const paymentTx = await prisma.payment_transaction.findFirst({
      where: {
        booking_id: booking.id,
        status: 'succeeded',
      },
      orderBy: { created_at: 'desc', },
      select: {
        id: true,
        provider: true,
        provider_object_id: true,
        amount_minor: true,
        currency_iso3: true,
        raw_gateway_json: true,
      },
    });

    if (!paymentTx) {
      return NextResponse.json(
        { message: 'No settled payment was found for this booking.', },
        { status: 400, }
      );
    }

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

    let createdIntent: Awaited<ReturnType<typeof prisma.wallet_transaction.create>>;
    try {
      const txResult = await prisma.$transaction(async (tx) => {
        const existing = await tx.wallet_transaction.findFirst({
          where: {
            wallet_id: walletRow.id,
            booking_id: booking.id,
            type: 'refund',
            status: { in: ['pending', 'succeeded'], },
            OR: [
              {
                metadata: {
                  path: ['payment_transaction_id'],
                  equals: paymentTx.id,
                },
              },
              {
                metadata: {
                  path: ['payment_id'],
                  equals: parsed.data.paymentId,
                },
              }
            ],
          },
          orderBy: { created_at: 'desc', },
        });

        if (existing) {
          return {
 existing,
created: null, 
};
        }

        const created = await tx.wallet_transaction.create({
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
              payment_transaction_id: paymentTx.id,
              payment_provider_object_id: paymentTx.provider_object_id,
              booking_id: booking.id,
              requested_by: auth.dbUser!.auth_user_id,
            },
          },
        });

        return {
 existing: null,
created, 
};
      }, { isolationLevel: 'Serializable', });

      if (txResult.existing) {
        return NextResponse.json({
          transaction: {
            id: txResult.existing.id,
            type: txResult.existing.type,
            status: txResult.existing.status,
            amountMinor: txResult.existing.amount_minor.toString(),
            currency: txResult.existing.currency,
          },
          refundId: txResult.existing.external_reference,
        });
      }

      createdIntent = txResult.created!;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        return NextResponse.json(
          { message: 'A refund for this booking is already being processed.', },
          { status: 409, }
        );
      }

      throw error;
    }

    if (paymentTx.provider === 'xendit') {
      try {
        const refund = await submitXenditRefund({
          walletTransactionId: createdIntent.id,
          partnerUserId: auth.dbUser!.user_id,
          bookingId: booking.id,
          paymentTransaction: {
            id: paymentTx.id,
            provider_object_id: paymentTx.provider_object_id,
            amount_minor: paymentTx.amount_minor,
            currency_iso3: paymentTx.currency_iso3,
            raw_gateway_json: paymentTx.raw_gateway_json,
          },
          amountMinor: BigInt(amountMinor),
          reason: parsed.data.reason ?? 'other',
          requestedByAuthUserId: auth.dbUser!.auth_user_id,
          metadata: {
            internal_user_id: auth.dbUser!.user_id.toString(),
            ...(metadata ?? {}),
          },
          providedPaymentReference: parsed.data.paymentId,
        });

        return NextResponse.json({
          transaction: {
            id: refund.transaction.id,
            type: refund.transaction.type,
            status: refund.transaction.status,
            amountMinor: refund.transaction.amount_minor.toString(),
            currency: refund.transaction.currency,
          },
          refundId: refund.providerRefund?.refundId ?? refund.transaction.external_reference,
        });
      } catch (refundError) {
        if (refundError instanceof FinancialProviderError) {
          return NextResponse.json(
            { message: refundError.message, },
            { status: refundError.status, }
          );
        }

        console.error('Xendit refund request failed', refundError);
        return NextResponse.json(
          { message: 'Unable to process refund right now.', },
          { status: 500, }
        );
      }
    }

    await prisma.wallet_transaction.update({
      where: { id: createdIntent.id, },
      data: {
        status: 'failed',
        updated_at: new Date(),
      },
    });

    return NextResponse.json(
      { message: 'This booking was paid through an unsupported legacy provider and cannot be refunded here.', },
      { status: 409, }
    );
  } catch (error) {
    if (error instanceof FinancialProviderError) {
      return NextResponse.json(
        { message: error.message, },
        { status: error.status, }
      );
    }

    console.error('Refund request failed', error);
    return NextResponse.json(
      { message: 'Unable to process refund right now.', },
      { status: 500, }
    );
  }
}
