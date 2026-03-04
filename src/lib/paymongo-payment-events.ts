import { prisma } from '@/lib/prisma';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function readNestedObject(root: unknown, keys: string[]): JsonObject | null {
  let current: unknown = root;
  for (const key of keys) {
    const candidate = asObject(current);
    if (!candidate || !(key in candidate)) {
      return null;
    }
    current = candidate[key];
  }

  return asObject(current);
}

function readNestedString(root: unknown, keys: string[]): string | null {
  let current: unknown = root;
  for (const key of keys) {
    const candidate = asObject(current);
    if (!candidate || !(key in candidate)) {
      return null;
    }
    current = candidate[key];
  }

  return typeof current === 'string' ? current : null;
}

export function resolveBookingIdFromPaymongoMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  if (!metadata) return null;

  const candidate = metadata.booking_id ?? metadata.bookingId;
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return String(Math.trunc(candidate));
  }

  return null;
}

function resolveBookingIdFromPaymentEventPayload(payload: unknown) {
  const metadata = readNestedObject(payload, ['data', 'attributes', 'data', 'object', 'metadata']);
  return resolveBookingIdFromPaymongoMetadata(metadata);
}

function resolvePaymentStatusFromPayload(payload: unknown) {
  return readNestedString(payload, ['data', 'attributes', 'data', 'object', 'status'])?.toLowerCase() ?? null;
}

export async function resolveLatestPaidPaymongoPaymentIdForBooking(bookingId: string) {
  // bookingId is server-generated UUIDs in all callers; the template literal keeps
  // parameters bound safely through Prisma's SQL binding.
  const rows = await prisma.$queryRaw<{ payment_id: string | null }[]>`
    SELECT pe.provider_object_id AS payment_id
    FROM payment_event pe
    WHERE pe.provider = 'paymongo'::gateway
      AND pe.event_type LIKE 'payment.%'
      AND (
        pe.payload_json #>> '{data,attributes,data,object,metadata,booking_id}' = ${bookingId}
        OR pe.payload_json #>> '{data,attributes,data,object,metadata,bookingId}' = ${bookingId}
      )
      AND LOWER(COALESCE(pe.payload_json #>> '{data,attributes,data,object,status}', '')) = 'paid'
    ORDER BY pe.received_at DESC
    LIMIT 1
  `;

  const first = rows[0]?.payment_id?.trim();
  return first && first.length > 0 ? first : null;
}

export async function isPaymongoPaymentLinkedToBooking(paymentId: string, bookingId: string) {
  const event = await prisma.payment_event.findFirst({
    where: {
      provider: 'paymongo',
      provider_object_id: paymentId,
      event_type: { startsWith: 'payment.', },
    },
    orderBy: { received_at: 'desc', },
    select: { payload_json: true, },
  });

  if (!event) {
    const paymentTx = await prisma.payment_transaction.findFirst({
      where: {
        provider: 'paymongo',
        booking_id: bookingId,
        status: 'succeeded',
      },
      orderBy: { created_at: 'desc', },
      select: {
        provider_object_id: true,
        raw_gateway_json: true,
      },
    });

    if (!paymentTx) {
      return false;
    }

    if (paymentTx.provider_object_id === paymentId) {
      return true;
    }

    const rawId = readNestedString(paymentTx.raw_gateway_json, ['id']);
    return rawId === paymentId;
  }

  const linkedBookingId = resolveBookingIdFromPaymentEventPayload(event.payload_json);
  const status = resolvePaymentStatusFromPayload(event.payload_json);
  return linkedBookingId === bookingId && status === 'paid';
}
