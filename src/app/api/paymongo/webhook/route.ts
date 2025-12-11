import { NextRequest, NextResponse } from 'next/server';

import {
  checkoutEventSchema,
  handleCheckoutEvent,
  handleWalletEvent,
  walletEventSchema
} from './handlers';

import { isPaymongoSignatureFresh, parsePaymongoSignatureHeader, verifyPaymongoSignature } from '@/lib/paymongo';

const RECEIVED_RESPONSE = NextResponse.json(
  { received: true, },
  { status: 200, }
);

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
  let parsedPayload: Record<string, unknown> | null = null;

  try {
    parsedPayload = JSON.parse(payloadText);
  } catch (error) {
    console.error('Failed to parse PayMongo webhook payload', error);
    return NextResponse.json(
      { message: 'Invalid webhook payload.', },
      { status: 400, }
    );
  }

  const attributes =
    (parsedPayload?.data as Record<string, unknown> | undefined)
      ?.attributes as Record<string, unknown> | undefined;
  const isLive = attributes?.livemode === true;

  if (
    !verifyPaymongoSignature({
      payload: payloadText,
      signature,
      useLiveSignature: isLive,
    })
  ) {
    return NextResponse.json(
      { message: 'Invalid PayMongo signature.', },
      { status: 401, }
    );
  }

  if (!(await isPaymongoSignatureFresh(signature))) {
    return NextResponse.json(
      { message: 'Stale PayMongo signature.', },
      { status: 400, }
    );
  }

  const eventType = attributes?.type;
  if (!eventType || typeof eventType !== 'string') {
    return RECEIVED_RESPONSE;
  }

  if (eventType.startsWith('wallet.transaction')) {
    const validation = walletEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Unexpected wallet webhook payload schema.', },
        { status: 400, }
      );
    }

    return handleWalletEvent(validation.data.data.attributes);
  }

  if (eventType.includes('checkout')) {
    const validation = checkoutEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      console.warn('Unexpected checkout webhook payload');
      return RECEIVED_RESPONSE;
    }

    return handleCheckoutEvent(validation.data.data.attributes);
  }

  return RECEIVED_RESPONSE;
}
