import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { isPaymongoSignatureFresh, parsePaymongoSignatureHeader, verifyPaymongoSignature } from '@/lib/paymongo';

const walletEventSchema = z.object({
  data: z.object({
    id: z.string(),
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      data: z.object({
        object: z.object({
          id: z.string(),
          wallet_id: z.string().nullable(),
          type: z.string(),
          status: z.enum(['pending', 'succeeded', 'failed']),
          amount_minor: z.number(),
          net_amount_minor: z.number().nullable(),
          currency: z.string(),
          description: z.string().nullable(),
          external_reference: z.string().nullable(),
          metadata: z.record(z.any()).nullable(),
          booking_id: z.string().uuid().nullable(),
          created_at: z.union([z.number(), z.string()]),
        }),
      }),
    }),
  }),
});

type WalletEvent = z.infer<typeof walletEventSchema>['data']['attributes'];

function resolveTransactionType(eventType: string) {
  const match = eventType.match(/^wallet\.transaction\.(cash_in|charge|refund|payout)/);
  if (!match) {
    return null;
  }

  return match[1] as 'cash_in' | 'charge' | 'refund' | 'payout';
}

function normalizeTimestamp(value: number | string) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return new Date();
  }

  return parsed > 1e12 ? new Date(parsed) : new Date(parsed * 1000);
}

function getInternalUserId(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const candidate = metadata.internal_user_id ?? metadata.user_id;
  if (candidate == null) return null;

  if (typeof candidate === 'string') {
    const numeric = Number(candidate);
    return Number.isFinite(numeric) ? BigInt(Math.trunc(numeric)) : null;
  }

  if (typeof candidate === 'number') {
    return BigInt(Math.trunc(candidate));
  }

  if (typeof candidate === 'bigint') {
    return candidate;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const signatureHeader = req.headers.get('Paymongo-Signature');
  const signature = parsePaymongoSignatureHeader(signatureHeader);
  if (!signature) {
    return NextResponse.json(
      { message: 'Missing or malformed signature header.', },
      { status: 400, }
    );
  }

  const buffer = await req.arrayBuffer();
  const payloadText = new TextDecoder().decode(buffer);

  let parsedEvent: WalletEvent;

  try {
    const json = JSON.parse(payloadText);
    const validation = walletEventSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Unexpected webhook payload schema.', },
        { status: 400, }
      );
    }

    parsedEvent = validation.data.attributes;
  } catch (error) {
    console.error('Failed to parse PayMongo webhook payload', error);
    return NextResponse.json(
      { message: 'Invalid webhook payload.', },
      { status: 400, }
    );
  }

  const isLive = parsedEvent.livemode === true;

  if (!verifyPaymongoSignature({
    payload: payloadText,
    signature,
    useLiveSignature: isLive,
  })) {
    return NextResponse.json(
      { message: 'Invalid PayMongo signature.', },
      { status: 401, }
    );
  }

  if (!isPaymongoSignatureFresh(signature)) {
    return NextResponse.json(
      { message: 'Stale PayMongo signature.', },
      { status: 400, }
    );
  }

  const walletObject = parsedEvent.data.object;
  const transactionType = resolveTransactionType(parsedEvent.type);
  if (!transactionType) {
    return NextResponse.json({ received: true, }, { status: 200, });
  }

  const internalUserId = getInternalUserId(walletObject.metadata);
  if (!internalUserId) {
    console.warn('PayMongo wallet webhook missing internal_user_id metadata');
    return NextResponse.json({ received: true, }, { status: 200, });
  }

  const walletRow = await prisma.wallet.findUnique({ where: { user_id: internalUserId, }, });

  if (!walletRow) {
    console.warn('Wallet webhook could not find internal wallet', internalUserId.toString());
    return NextResponse.json({ received: true, }, { status: 200, });
  }

  const alreadyProcessed = await prisma.wallet_transaction.findFirst({ where: { external_reference: walletObject.id, }, });

  if (alreadyProcessed) {
    return NextResponse.json({ received: true, }, { status: 200, });
  }

  const amountMinor = BigInt(Math.round(walletObject.amount_minor));
  const netAmount = walletObject.net_amount_minor
    ? BigInt(Math.round(walletObject.net_amount_minor))
    : null;
  const recordedAt = normalizeTimestamp(walletObject.created_at);
  const status = walletObject.status as 'pending' | 'succeeded' | 'failed';

  const balanceDelta =
    status === 'succeeded'
      ? (transactionType === 'cash_in' || transactionType === 'refund'
        ? amountMinor
        : amountMinor * -1n)
      : 0n;

  await prisma.$transaction(async (tx) => {
    await tx.wallet_transaction.create({
      data: {
        wallet_id: walletRow.id,
        type: transactionType,
        status,
        amount_minor: amountMinor,
        net_amount_minor: netAmount,
        currency: walletObject.currency || walletRow.currency,
        description: walletObject.description ?? null,
        external_reference: walletObject.id,
        metadata: walletObject.metadata ?? null,
        booking_id: walletObject.booking_id ?? null,
        created_at: recordedAt,
        updated_at: recordedAt,
      },
    });

    if (balanceDelta !== 0n) {
      await tx.wallet.update({
        where: { id: walletRow.id, },
        data: {
          balance_minor: { increment: balanceDelta as bigint, },
          updated_at: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ received: true, }, { status: 200, });
}
