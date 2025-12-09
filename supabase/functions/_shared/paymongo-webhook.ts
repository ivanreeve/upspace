import { z } from 'zod';

export const walletEventSchema = z.object({
  data: z.object({
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
          metadata: z.record(z.string(), z.any()).nullable(),
          booking_id: z.string().uuid().nullable(),
          created_at: z.union([z.number(), z.string()]),
        }),
      }),
    }),
  }),
});

export type WalletEventAttributes = z.infer<typeof walletEventSchema>['data']['attributes'];

export const checkoutEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      data: z.object({
        object: z.object({
          id: z.string(),
          amount: z.number(),
          currency: z.string(),
          metadata: z.record(z.string(), z.unknown()).nullable(),
          status: z.string(),
        }),
      }),
    }),
  }),
});

export type CheckoutEventAttributes = z.infer<typeof checkoutEventSchema>['data']['attributes'];

export const paymentEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      data: z.object({
        object: z.object({
          id: z.string(),
          amount: z.number().optional(),
          currency: z.string().optional(),
          metadata: z.record(z.string(), z.unknown()).nullable(),
          status: z.string(),
        }),
      }),
    }),
  }),
});

export type PaymentEventAttributes = z.infer<typeof paymentEventSchema>['data']['attributes'];

export function resolveTransactionType(eventType: string) {
  const match = eventType.match(/^wallet\.transaction\.(cash_in|charge|refund|payout)/);
  return match ? (match[1] as 'cash_in' | 'charge' | 'refund' | 'payout') : null;
}

export function normalizeTimestamp(value: number | string) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return new Date();
  }

  return parsed > 1e12 ? new Date(parsed) : new Date(parsed * 1000);
}

export function getInternalUserId(metadata: Record<string, unknown> | null) {
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
