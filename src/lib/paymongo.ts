'use server';

import { createHmac, timingSafeEqual } from 'node:crypto';

const PAYMONGO_API_URL = process.env.PAYMONGO_API_URL?.replace(/\/+$/u, '') ?? 'https://api.paymongo.com/v1';
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

if (!PAYMONGO_SECRET_KEY) {
  console.warn('PayMongo secret key is missing (PAYMONGO_SECRET_KEY).');
}
if (!PAYMONGO_WEBHOOK_SECRET) {
  console.warn('PayMongo webhook secret is missing (PAYMONGO_WEBHOOK_SECRET).');
}

export type PaymongoRefundReason =
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'other';

export type PaymongoError = {
  type: string;
  message: string;
  code?: string;
};

export type PaymongoRefundResponse = {
  id: string;
  attributes: {
    status: 'pending' | 'succeeded' | 'failed';
    amount: number;
    currency: string;
    reason: PaymongoRefundReason;
    notes?: string | null;
    payment_id: string;
    livemode: boolean;
    created_at: number;
    updated_at: number;
  };
};

function ensurePaymongoSecret() {
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error('Missing PAYMONGO_SECRET_KEY in environment.');
  }
}

async function paymongoFetch<T>(path: string, options: RequestInit) {
  ensurePaymongoSecret();

  const response = await fetch(`${PAYMONGO_API_URL}/${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error: PaymongoError = payload?.errors?.[0] ?? {
      type: 'unknown_error',
      message: 'PayMongo request failed.',
    };
    throw new Error(`PayMongo ${path} failed: ${error.message}`);
  }

  return payload as T;
}

export async function createPaymongoRefund(opts: {
  paymentId: string;
  amountMinor: number;
  reason?: PaymongoRefundReason;
  notes?: string;
  metadata?: Record<string, string>;
}) {
  const payload = {
    data: {
      attributes: {
        payment_id: opts.paymentId,
        amount: opts.amountMinor,
        ...(opts.reason ? { reason: opts.reason, } : {}),
        ...(opts.notes ? { notes: opts.notes, } : {}),
        ...(opts.metadata ? { metadata: opts.metadata, } : {}),
      },
    },
  };

  return paymongoFetch<{ data: PaymongoRefundResponse }>('refunds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type PaymongoWebhookSignature = {
  timestamp: number;
  te?: string;
  li?: string;
};

export function parsePaymongoSignatureHeader(header: string | null): PaymongoWebhookSignature | null {
  if (!header) return null;

  const normalized = header.split(',').map((part) => part.trim());
  const result: PaymongoWebhookSignature = { timestamp: 0, };

  for (const part of normalized) {
    const [key, value] = part.split('\=').map((segment) => segment.trim());
    if (!key || !value) continue;
    if (key === 't') {
      result.timestamp = Number(value);
    } else if (key === 'te') {
      result.te = value;
    } else if (key === 'li') {
      result.li = value;
    }
  }

  if (!result.timestamp) {
    return null;
  }

  return result;
}

export function verifyPaymongoSignature({
  payload,
  signature,
  secret = PAYMONGO_WEBHOOK_SECRET,
  useLiveSignature,
}: {
  payload: string;
  signature: PaymongoWebhookSignature;
  secret?: string | null;
  useLiveSignature?: boolean;
}) {
  if (!secret) {
    throw new Error('PAYMONGO_WEBHOOK_SECRET is not configured.');
  }

  const signatureValue = useLiveSignature ? signature.li : signature.te;
  if (!signatureValue) {
    return false;
  }

  const unsignedString = `${signature.timestamp}.${payload}`;
  const hmac = createHmac('sha256', secret).update(unsignedString).digest('hex');
  const incoming = Buffer.from(signatureValue, 'hex');
  const computed = Buffer.from(hmac, 'hex');

  try {
    return timingSafeEqual(incoming, computed);
  } catch (error) {
    return false;
  }
}

export function isPaymongoSignatureFresh(signature: PaymongoWebhookSignature, toleranceSeconds = 300) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - signature.timestamp) <= toleranceSeconds;
}
