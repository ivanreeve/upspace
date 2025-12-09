import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from '@supabase/supabase-js';

declare const Deno: {
  env: {
    get(name: string): string | null;
  };
  serve(callback: (req: Request) => Promise<Response> | Response): void;
};

import {
  checkoutEventSchema,
  getInternalUserId,
  normalizeTimestamp,
  resolveTransactionType,
  walletEventSchema,
  paymentEventSchema,
  type CheckoutEventAttributes,
  type PaymentEventAttributes,
  type WalletEventAttributes
} from '../_shared/paymongo-webhook';
import { isPaymongoSignatureFresh, parsePaymongoSignatureHeader, verifyPaymongoSignatureWithSecret } from '../_shared/paymongo-signature';

type SupabaseClient = ReturnType<typeof createClient>;
type PaymentEvent = PaymentEventAttributes;

const SUPABASE_URL =
  Deno.env.get('EDGE_SUPABASE_URL') ??
  Deno.env.get('SUPABASE_URL') ??
  Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('EDGE_SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PAYMONGO_WEBHOOK_SECRET = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
const APP_URL = (
  Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000'
).replace(/\/+$/, '');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Supabase admin credentials are missing. Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}

if (!PAYMONGO_WEBHOOK_SECRET) {
  throw new Error('PAYMONGO_WEBHOOK_SECRET must be configured.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const RECEIVED_RESPONSE = new Response(JSON.stringify({ received: true, }), {
  status: 200,
  headers: { 'Content-Type': 'application/json', },
});

function jsonResponse(
  body: Record<string, unknown>,
  init?: Omit<ResponseInit, 'body'>
) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

function resolveBookingIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;

  const candidate = metadata.booking_id ?? metadata.bookingId;
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return String(candidate);
  }

  return null;
}

async function confirmBookingById(bookingId: string) {
  const {
 data: bookingRow, error: bookingError, 
} = await supabase
    .from('booking')
    .select(
      'id,space_id,space_name,area_id,area_name,booking_hours,price_minor,status,user_auth_id,partner_auth_id,currency'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError || !bookingRow) {
    console.warn('Checkout webhook could not find booking', bookingId, bookingError);
    return;
  }

  if (bookingRow.status === 'confirmed') {
    return;
  }

  const { error: updateError, } = await supabase
    .from('booking')
    .update({ status: 'confirmed', })
    .eq('id', bookingId);

  if (updateError) {
    console.error('Failed to confirm booking', bookingId, updateError);
    return;
  }

  const bookingHref = `/marketplace/${bookingRow.space_id}`;
  const notifications = [
    {
      user_auth_id: bookingRow.user_auth_id,
      title: 'Booking confirmed',
      body: `${bookingRow.area_name} at ${bookingRow.space_name} is confirmed.`,
      href: bookingHref,
      type: 'booking_confirmed',
      booking_id: bookingRow.id,
      space_id: bookingRow.space_id,
      area_id: bookingRow.area_id,
    }
  ];

  if (bookingRow.partner_auth_id) {
    notifications.push({
      user_auth_id: bookingRow.partner_auth_id,
      title: 'New booking received',
      body: `${bookingRow.area_name} in ${bookingRow.space_name} was just booked.`,
      href: bookingHref,
      type: 'booking_received',
      booking_id: bookingRow.id,
      space_id: bookingRow.space_id,
      area_id: bookingRow.area_id,
    });
  }

  const { error: notificationError, } = await supabase
    .from('app_notification')
    .insert(notifications);

  if (notificationError) {
    console.error('Failed to create booking notifications', notificationError);
  }

  try {
    const { data: customer, } = await supabase.auth.admin.getUserById(
      bookingRow.user_auth_id
    );
    if (customer?.user?.email) {
      console.log(
        'Booking confirmed for',
        bookingRow.id,
        'customer email:',
        customer.user.email,
        'Link:',
        `${APP_URL}${bookingHref}`
      );
    }
  } catch (error) {
    console.error('Failed to look up customer email', error);
  }
}

async function cancelBookingById(bookingId: string) {
  const {
 data: bookingRow, error: bookingError, 
} = await supabase
    .from('booking')
    .select('id,status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError || !bookingRow) {
    console.warn('Payment failure webhook could not find booking', bookingId, bookingError);
    return;
  }

  if (bookingRow.status === 'cancelled') {
    return;
  }

  const { error: updateError, } = await supabase
    .from('booking')
    .update({ status: 'cancelled', })
    .eq('id', bookingId);

  if (updateError) {
    console.error('Failed to cancel booking after payment failure', bookingId, updateError);
  }
}

async function handleWalletEvent(event: WalletEventAttributes) {
  const walletObject = event.data.object;
  const transactionType = resolveTransactionType(event.type);
  if (!transactionType) {
    return;
  }

  const internalUserId = getInternalUserId(walletObject.metadata);
  if (!internalUserId) {
    console.warn('PayMongo wallet webhook missing internal_user_id metadata');
    return;
  }

  const {
 data: walletRow, error: walletError, 
} = await supabase
    .from('wallet')
    .select('id,balance_minor,currency')
    .eq('user_id', internalUserId.toString())
    .maybeSingle();

  if (walletError || !walletRow) {
    console.warn(
      'Wallet webhook could not find internal wallet',
      internalUserId.toString(),
      walletError
    );
    return;
  }

  const { data: alreadyProcessed, } = await supabase
    .from('wallet_transaction')
    .select('id')
    .eq('external_reference', walletObject.id)
    .limit(1)
    .maybeSingle();

  if (alreadyProcessed) {
    return;
  }

  const amountMinor = BigInt(Math.round(walletObject.amount_minor));
  const netAmount = walletObject.net_amount_minor
    ? BigInt(Math.round(walletObject.net_amount_minor))
    : null;
  const recordedAt = normalizeTimestamp(walletObject.created_at).toISOString();
  const status = walletObject.status as 'pending' | 'succeeded' | 'failed';

  const balanceDelta =
    status === 'succeeded'
      ? (transactionType === 'cash_in' || transactionType === 'refund'
        ? amountMinor
        : amountMinor * BigInt(-1))
      : BigInt(0);

  const { error: transactionError, } = await supabase
    .from('wallet_transaction')
    .insert({
      wallet_id: walletRow.id,
      type: transactionType,
      status,
      amount_minor: amountMinor.toString(),
      net_amount_minor: netAmount ? netAmount.toString() : null,
      currency: walletObject.currency || walletRow.currency,
      description: walletObject.description ?? null,
      external_reference: walletObject.id,
      metadata: walletObject.metadata ?? null,
      booking_id: walletObject.booking_id ?? null,
      created_at: recordedAt,
      updated_at: recordedAt,
    });

  if (transactionError) {
    console.error(
      'Failed to record wallet transaction',
      transactionError,
      walletObject
    );
    return;
  }

    if (balanceDelta === BigInt(0)) {
    return;
  }

  const currentBalance = BigInt(walletRow.balance_minor ?? '0');
  const nextBalance = (currentBalance + balanceDelta).toString();

  const { error: balanceError, } = await supabase
    .from('wallet')
    .update({
      balance_minor: nextBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', walletRow.id);

  if (balanceError) {
    console.error('Failed to update wallet balance', balanceError, walletRow.id);
  }
}

async function handleCheckoutEvent(event: CheckoutEventAttributes) {
  if (!event.type.includes('paid')) {
    return;
  }

  const checkoutObject = event.data.object;
  const bookingId = resolveBookingIdFromMetadata(checkoutObject.metadata ?? {});
  if (!bookingId) {
    console.warn('PayMongo checkout webhook missing booking metadata');
    return;
  }

  await confirmBookingById(bookingId);
}

async function handlePaymentEvent(event: PaymentEvent) {
  const paymentObject = event.data.object;
  const bookingId = resolveBookingIdFromMetadata(paymentObject.metadata ?? {});
  if (!bookingId) {
    console.warn('PayMongo payment webhook missing booking metadata');
    return;
  }

  const normalizedType = event.type.toLowerCase();
  const status = paymentObject.status.toLowerCase();

  if (normalizedType.includes('failed') || status === 'failed') {
    await cancelBookingById(bookingId);
    return;
  }

  if (normalizedType.includes('paid') || status === 'paid') {
    await confirmBookingById(bookingId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed', }, { status: 405, });
  }

  const signatureHeader = req.headers.get('Paymongo-Signature');
  const signature = parsePaymongoSignatureHeader(signatureHeader);
  if (!signature) {
    return jsonResponse(
      { message: 'Missing or malformed signature header.', },
      { status: 400, }
    );
  }

  const payloadText = await req.text();
  let parsedPayload: Record<string, unknown> | null = null;

  try {
    parsedPayload = JSON.parse(payloadText);
  } catch (error) {
    console.error('Failed to parse PayMongo webhook payload', error);
    return jsonResponse({ message: 'Invalid webhook payload.', }, { status: 400, });
  }

  const attributes = (parsedPayload?.data as Record<string, unknown> | undefined)
    ?.attributes as Record<string, unknown> | undefined;
  const isLive = attributes?.livemode === true;

  const signatureValid = await verifyPaymongoSignatureWithSecret({
    payload: payloadText,
    signature,
    secret: PAYMONGO_WEBHOOK_SECRET,
    useLiveSignature: isLive,
  });

  if (!signatureValid) {
    return jsonResponse({ message: 'Invalid PayMongo signature.', }, { status: 401, });
  }

  if (!isPaymongoSignatureFresh(signature)) {
    return jsonResponse({ message: 'Stale PayMongo signature.', }, { status: 400, });
  }

  const eventType = attributes?.type;
  if (!eventType || typeof eventType !== 'string') {
    return RECEIVED_RESPONSE;
  }

  console.info('PayMongo webhook received', {
    type: eventType,
    id: (parsedPayload?.data as { id?: string } | undefined)?.id ?? null,
    livemode: attributes?.livemode === true,
    created_at: attributes?.created_at ?? null,
    pending_webhooks: attributes?.pending_webhooks ?? null,
    payload: parsedPayload,
  });

  if (eventType.startsWith('wallet.transaction')) {
    const validation = walletEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      return jsonResponse(
        { message: 'Unexpected wallet webhook payload schema.', },
        { status: 400, }
      );
    }

    await handleWalletEvent(validation.data.data.attributes);
    return RECEIVED_RESPONSE;
  }

  if (eventType.includes('checkout')) {
    const validation = checkoutEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      console.warn('Unexpected checkout webhook payload');
      return RECEIVED_RESPONSE;
    }

    await handleCheckoutEvent(validation.data.data.attributes);
    return RECEIVED_RESPONSE;
  }

  if (eventType.startsWith('payment.')) {
    const validation = paymentEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      return jsonResponse({ message: 'Unexpected payment webhook payload.', }, { status: 400, });
    }

    await handlePaymentEvent(validation.data.data.attributes);
    return RECEIVED_RESPONSE;
  }

  return RECEIVED_RESPONSE;
});
