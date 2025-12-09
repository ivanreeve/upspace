import { isPaymongoSignatureFresh as isPaymongoSignatureFreshShared, parsePaymongoSignatureHeader as parsePaymongoSignatureHeaderShared, verifyPaymongoSignatureWithSecret } from '../../supabase/functions/_shared/paymongo-signature.ts';
import type { PaymongoWebhookSignature } from '../../supabase/functions/_shared/paymongo-signature.ts';

const PAYMONGO_API_URL = process.env.PAYMONGO_API_URL?.replace(/\/+$/u, '') ?? 'https://api.paymongo.com/v1';
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;
function resolveDefaultPaymentMethods() {
  const raw = process.env.PAYMONGO_CHECKOUT_PAYMENT_METHODS ??
    'card,gcash,grab_pay,paymaya';
  const methods = raw
    .split(',')
    .map((method) => method.trim())
    .filter((method) => method.length > 0);

  return methods.length > 0 ? methods : ['card'];
}

const PAYMONGO_DEFAULT_PAYMENT_METHODS = resolveDefaultPaymentMethods();

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
  message?: string;
  code?: string;
  detail?: string;
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
    const error: PaymongoError | undefined = payload?.errors?.[0];
    const detail =
      error?.message ??
      // Some PayMongo responses use `detail` instead of `message`.
      (typeof error?.['detail'] === 'string' ? error['detail'] : null) ??
      (payload ? JSON.stringify(payload) : 'PayMongo request failed.');

    console.error('PayMongo request failed', {
      path,
      status: response.status,
      payload,
    });

    throw new Error(`PayMongo ${path} failed: ${detail}`);
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

export type PaymongoCheckoutLineItem = {
  quantity?: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: {
      name: string;
      description?: string | null;
    };
  };
};

type PaymongoCheckoutLineItemPayload = {
  amount: number;
  currency: string;
  name: string;
  description?: string | null;
  quantity: number;
};

export type PaymongoCheckoutSessionResponse = {
  id: string;
  attributes: {
    amount: number;
    currency: string;
    checkout_url: string;
    success_url: string | null;
    cancel_url: string | null;
    description: string | null;
    metadata: Record<string, string> | null;
    status: 'active' | 'expired';
  };
};

export async function createPaymongoCheckoutSession(opts: {
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  description: string;
  lineItemName: string;
  metadata: Record<string, string>;
  paymentMethodTypes?: string[];
  lineItems?: PaymongoCheckoutLineItem[];
}) {
  const resolvedLineItems: PaymongoCheckoutLineItemPayload[] =
    opts.lineItems && opts.lineItems.length > 0
      ? opts.lineItems.map((item) => {
        const quantity = Number.isFinite(item.quantity) && (item.quantity ?? 0) > 0
          ? Math.trunc(item.quantity ?? 1)
          : 1;
        return {
          amount: Math.max(0, Math.trunc(item.price_data.unit_amount)),
          currency: item.price_data.currency,
          name: item.price_data.product_data.name,
          description: item.price_data.product_data.description ?? null,
          quantity,
        };
      })
      : [
        {
          amount: Math.max(0, Math.trunc(opts.amountMinor)),
          currency: opts.currency,
          name: opts.lineItemName,
          description: opts.description,
          quantity: 1,
        }
      ];

  const resolvedAmount = resolvedLineItems.reduce<number>((total, item) => {
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    return total + item.amount * quantity;
  }, 0);

  const payload = {
    data: {
      attributes: {
        amount: resolvedAmount,
        currency: opts.currency,
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        description: opts.description,
        metadata: opts.metadata,
        payment_method_types: opts.paymentMethodTypes ?? PAYMONGO_DEFAULT_PAYMENT_METHODS,
        line_items: resolvedLineItems,
      },
    },
  };

  return paymongoFetch<{ data: PaymongoCheckoutSessionResponse }>(
    'checkout_sessions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export { isPaymongoSignatureFreshShared as isPaymongoSignatureFresh, parsePaymongoSignatureHeaderShared as parsePaymongoSignatureHeader };
export type { PaymongoWebhookSignature };

export async function verifyPaymongoSignature({
  payload,
  signature,
  secret = PAYMONGO_WEBHOOK_SECRET,
  useLiveSignature,
}: {
  payload: string;
  signature: PaymongoWebhookSignature;
  secret?: string | null;
  useLiveSignature?: boolean;
}): Promise<boolean> {
  const resolvedSecret = secret ?? PAYMONGO_WEBHOOK_SECRET;
  if (!resolvedSecret) {
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

export async function isPaymongoSignatureFresh(signature: PaymongoWebhookSignature, toleranceSeconds = 300) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - signature.timestamp) <= toleranceSeconds;
}
