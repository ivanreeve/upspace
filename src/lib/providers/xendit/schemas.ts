import { z } from 'zod';

const bigintLikeSchema = z.union([
  z.bigint(),
  z.number().int(),
  z.string().regex(/^\d+$/)
]).transform((value) => BigInt(value));

const decimalLikeSchema = z.union([
  z.number(),
  z.string().regex(/^\d+(\.\d+)?$/)
]);

const xenditRawAccountSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  type: z.string().min(1),
  email: z.string().email().nullish(),
  public_profile: z.object({ business_name: z.string().min(1).nullish(), }).partial().passthrough().nullish(),
}).passthrough();

const xenditRawBalanceSchema = z.object({
  balance: bigintLikeSchema,
  currency: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  account_type: z.string().min(1).optional(),
}).passthrough();

const xenditPayoutChannelAmountSchema = z.object({
  minimum: decimalLikeSchema.nullish(),
  maximum: decimalLikeSchema.nullish(),
}).partial().passthrough();

const xenditRawPayoutChannelSchema = z.object({
  channel_code: z.string().min(1),
  channel_name: z.string().min(1),
  category: z.string().min(1),
  currency: z.string().min(1),
  country: z.string().min(1).nullish(),
  amount_limits: xenditPayoutChannelAmountSchema.nullish(),
}).passthrough();

const xenditRawPayoutSchema = z.object({
  id: z.string().min(1),
  reference_id: z.string().min(1),
  amount: decimalLikeSchema,
  currency: z.string().min(1),
  channel_code: z.string().min(1),
  status: z.string().min(1),
  estimated_arrival_time: z.string().min(1).nullish(),
  failure_code: z.string().min(1).nullish(),
  description: z.string().nullish(),
}).passthrough();

const xenditRawInvoiceSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().min(1),
  status: z.string().min(1),
  amount: decimalLikeSchema,
  currency: z.string().min(1),
  description: z.string().nullish(),
  invoice_url: z.string().url().nullish(),
  expiry_date: z.string().nullish(),
  success_redirect_url: z.string().url().nullish(),
  failure_redirect_url: z.string().url().nullish(),
  payer_email: z.string().email().nullish(),
  paid_at: z.string().nullish(),
  payment_method: z.string().nullish(),
  payment_id: z.string().min(1).nullish(),
  payment_request_id: z.string().min(1).nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
}).passthrough();

const xenditRawPaymentSchema = z.object({
  id: z.string().min(1),
  payment_request_id: z.string().min(1),
  status: z.string().min(1),
  currency: z.string().min(1),
  amount: decimalLikeSchema.nullish(),
}).passthrough();

const xenditRawRefundSchema = z.object({
  id: z.string().min(1),
  reference_id: z.string().min(1),
  payment_id: z.string().min(1).nullish(),
  payment_request_id: z.string().min(1),
  status: z.string().min(1),
  amount: decimalLikeSchema.nullish(),
  currency: z.string().min(1).nullish(),
  failure_reason: z.string().nullish(),
}).passthrough();

const xenditRefundWebhookEnvelopeSchema = z.object({
  refundSucceeded: z
    .object({ data: xenditRawRefundSchema, })
    .passthrough()
    .optional(),
  refundFailed: z
    .object({ data: xenditRawRefundSchema, })
    .passthrough()
    .optional(),
}).passthrough();

export type XenditAccount = z.infer<typeof xenditRawAccountSchema>;
export type XenditBalanceEntry = z.infer<typeof xenditRawBalanceSchema>;
export type XenditPayoutChannel = z.infer<typeof xenditRawPayoutChannelSchema>;
export type XenditPayout = z.infer<typeof xenditRawPayoutSchema>;
export type XenditInvoice = z.infer<typeof xenditRawInvoiceSchema>;
export type XenditPayment = z.infer<typeof xenditRawPaymentSchema>;
export type XenditRefund = z.infer<typeof xenditRawRefundSchema>;

export function parseXenditAccountPayload(payload: unknown): XenditAccount {
  const direct = xenditRawAccountSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: xenditRawAccountSchema, }).parse(payload).data;
}

export function parseXenditBalancePayload(payload: unknown): XenditBalanceEntry[] {
  const direct = z.array(xenditRawBalanceSchema).safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const wrapped = z.object({ data: z.array(xenditRawBalanceSchema), }).safeParse(payload);
  if (wrapped.success) {
    return wrapped.data.data;
  }

  const single = xenditRawBalanceSchema.safeParse(payload);
  if (single.success) {
    return [single.data];
  }

  return [z.object({ data: xenditRawBalanceSchema, }).parse(payload).data];
}

export function parseXenditPayoutChannelsPayload(payload: unknown): XenditPayoutChannel[] {
  const direct = z.array(xenditRawPayoutChannelSchema).safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: z.array(xenditRawPayoutChannelSchema), }).parse(payload).data;
}

export function parseXenditPayoutPayload(payload: unknown): XenditPayout {
  const direct = xenditRawPayoutSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: xenditRawPayoutSchema, }).parse(payload).data;
}

export function parseXenditPayoutListPayload(payload: unknown): XenditPayout[] {
  const direct = z.array(xenditRawPayoutSchema).safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: z.array(xenditRawPayoutSchema), }).parse(payload).data;
}

export function parseXenditInvoicePayload(payload: unknown): XenditInvoice {
  const direct = xenditRawInvoiceSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: xenditRawInvoiceSchema, }).parse(payload).data;
}

export function parseXenditPaymentPayload(payload: unknown): XenditPayment {
  const direct = xenditRawPaymentSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: xenditRawPaymentSchema, }).parse(payload).data;
}

export function parseXenditRefundPayload(payload: unknown): XenditRefund {
  const direct = xenditRawRefundSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  return z.object({ data: xenditRawRefundSchema, }).parse(payload).data;
}

export function parseXenditRefundWebhookPayload(payload: unknown): {
  eventType: 'refund.succeeded' | 'refund.failed';
  refund: XenditRefund;
} {
  const envelope = xenditRefundWebhookEnvelopeSchema.parse(payload);

  if (envelope.refundSucceeded?.data) {
    return {
      eventType: 'refund.succeeded',
      refund: envelope.refundSucceeded.data,
    };
  }

  if (envelope.refundFailed?.data) {
    return {
      eventType: 'refund.failed',
      refund: envelope.refundFailed.data,
    };
  }

  throw new z.ZodError([
    {
      code: 'custom',
      message: 'Unsupported Xendit refund webhook payload.',
      path: [],
    }
  ]);
}
