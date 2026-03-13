import {
  parseXenditInvoicePayload,
  parseXenditAccountPayload,
  parseXenditBalancePayload,
  parseXenditPaymentPayload,
  parseXenditPayoutChannelsPayload,
  parseXenditPayoutListPayload,
  parseXenditPayoutPayload,
  parseXenditRefundPayload
} from './schemas';

import {
  ProviderAuthError,
  ProviderConfigError,
  ProviderConflictError,
  ProviderTransientError,
  ProviderValidationError
} from '@/lib/providers/errors';
import type {
  CreateProviderBookingPaymentInput,
  CreateProviderRefundInput,
  CreatePartnerProviderAccountInput,
  CreateProviderPayoutInput,
  FinancialProvider,
  ProviderBookingPaymentResult,
  ProviderPaymentResult,
  PartnerProviderAccountResult,
  PartnerProviderAccountStatusResult,
  PartnerProviderBalanceResult,
  ProviderPayoutChannel,
  ProviderPayoutResult,
  ProviderPayoutStatus,
  ProviderRefundResult,
  ProviderRefundStatus
} from '@/lib/providers/types';

const XENDIT_API_URL = process.env.XENDIT_API_URL?.replace(/\/+$/u, '') ?? 'https://api.xendit.co';
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
const XENDIT_COUNTRY = process.env.XENDIT_COUNTRY?.trim().toUpperCase() || 'PH';
const ZERO_DECIMAL_CURRENCIES = new Set(['IDR', 'VND']);

type XenditRequestInit = RequestInit & {
  accountId?: string;
};

function ensureXenditSecretKey() {
  if (!XENDIT_SECRET_KEY) {
    throw new ProviderConfigError('Xendit is not configured yet. Add XENDIT_SECRET_KEY first.');
  }
}

function mapXenditStatus(rawStatus: string) {
  const normalized = rawStatus.trim().toUpperCase();

  switch (normalized) {
    case 'INVITED':
      return 'invited' as const;
    case 'REGISTERED':
      return 'registered' as const;
    case 'AWAITING_DOCS':
      return 'awaiting_docs' as const;
    case 'PENDING_VERIFICATION':
      return 'pending_verification' as const;
    case 'LIVE':
      return 'live' as const;
    case 'SUSPENDED':
      return 'suspended' as const;
    default:
      throw new ProviderValidationError(`Unsupported Xendit account status: ${rawStatus}`, 502);
  }
}

function mapXenditAccountType(rawType: string) {
  const normalized = rawType.trim().toUpperCase();
  if (normalized === 'OWNED') {
    return 'owned' as const;
  }

  if (normalized === 'MANAGED') {
    return 'managed' as const;
  }

  throw new ProviderValidationError(`Unsupported Xendit account type: ${rawType}`, 502);
}

function mapXenditPayoutChannelCategory(rawCategory: string) {
  const normalized = rawCategory.trim().toUpperCase();
  if (normalized === 'BANK' || normalized === 'EWALLET' || normalized === 'OTC') {
    return normalized;
  }

  throw new ProviderValidationError(`Unsupported Xendit payout channel category: ${rawCategory}`, 502);
}

function mapXenditPayoutStatus(rawStatus: string): ProviderPayoutStatus {
  const normalized = rawStatus.trim().toUpperCase();
  if (
    normalized === 'ACCEPTED' ||
    normalized === 'REQUESTED' ||
    normalized === 'FAILED' ||
    normalized === 'SUCCEEDED' ||
    normalized === 'CANCELLED' ||
    normalized === 'REVERSED'
  ) {
    return normalized;
  }

  throw new ProviderValidationError(`Unsupported Xendit payout status: ${rawStatus}`, 502);
}

function mapXenditRefundStatus(rawStatus: string): ProviderRefundStatus {
  const normalized = rawStatus.trim().toUpperCase();
  if (normalized === 'SUCCEEDED' || normalized === 'FAILED' || normalized === 'CANCELLED') {
    return normalized;
  }

  return 'PENDING';
}

function amountToMinorUnits(value: string | number | bigint, currency: string) {
  if (typeof value === 'bigint') {
    return value;
  }

  const normalizedCurrency = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    if (typeof value === 'number') {
      return BigInt(Math.trunc(value));
    }

    return BigInt(value);
  }

  const normalizedValue =
    typeof value === 'number'
      ? value.toFixed(2)
      : value.includes('.')
        ? value
        : `${value}.00`;
  const [whole, fraction = ''] = normalizedValue.split('.');
  const paddedFraction = fraction.padEnd(2, '0').slice(0, 2);

  return BigInt(`${whole}${paddedFraction}`);
}

function amountFromMinorUnits(amountMinor: bigint, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Number(amountMinor);
  }

  return Number(amountMinor) / 100;
}

function isXenditLiveMode() {
  return (XENDIT_SECRET_KEY ?? '').trim().startsWith('xnd_production_');
}

async function xenditFetch<T>(path: string, init: XenditRequestInit = {}) {
  ensureXenditSecretKey();

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Basic ${Buffer.from(`${XENDIT_SECRET_KEY}:`).toString('base64')}`);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  headers.set('Accept', 'application/json');

  if (init.accountId) {
    headers.set('for-user-id', init.accountId);
  }

  let response: Response;
  try {
    response = await fetch(`${XENDIT_API_URL}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    throw new ProviderTransientError(
      error instanceof Error ? error.message : 'Xendit request failed.'
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof payload.message === 'string' &&
        payload.message) ||
      (payload &&
        typeof payload === 'object' &&
        'error_code' in payload &&
        typeof payload.error_code === 'string' &&
        payload.error_code) ||
      'Xendit request failed.';

    if (response.status === 400 || response.status === 422) {
      const errorCode =
        payload &&
        typeof payload === 'object' &&
        'error_code' in payload &&
        typeof payload.error_code === 'string'
          ? payload.error_code
          : null;

      if (errorCode === 'DUPLICATE_ERROR') {
        throw new ProviderConflictError(message);
      }

      throw new ProviderValidationError(message, response.status);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderAuthError(message);
    }

    throw new ProviderTransientError(message);
  }

  return payload as T;
}

export class XenditFinancialProvider implements FinancialProvider {
  readonly name = 'xendit' as const;

  private mapInvoiceStatus(rawStatus: string): ProviderBookingPaymentResult['status'] {
    const normalized = rawStatus.trim().toUpperCase();

    if (normalized === 'PAID' || normalized === 'SETTLED') {
      return 'succeeded';
    }

    if (normalized === 'EXPIRED') {
      return 'cancelled';
    }

    if (normalized === 'FAILED') {
      return 'failed';
    }

    return 'pending';
  }

  private mapPayoutResult(payload: ReturnType<typeof parseXenditPayoutPayload>): ProviderPayoutResult {
    return {
      payoutId: payload.id,
      referenceId: payload.reference_id,
      amountMinor: amountToMinorUnits(payload.amount, payload.currency),
      currency: payload.currency,
      channelCode: payload.channel_code,
      status: mapXenditPayoutStatus(payload.status),
      estimatedArrivalTime: payload.estimated_arrival_time ?? null,
      failureCode: payload.failure_code ?? null,
      raw: payload,
    };
  }

  async createPartnerAccount(
    input: CreatePartnerProviderAccountInput
  ): Promise<PartnerProviderAccountResult> {
    const payload = await xenditFetch<unknown>('/v2/accounts', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        type: 'OWNED',
        public_profile: {
          business_name: input.displayName,
          business_type: 'INDIVIDUAL',
          country: XENDIT_COUNTRY,
        },
      }),
    });

    const account = parseXenditAccountPayload(payload);

    return {
      provider: this.name,
      providerAccountId: account.id,
      accountType: mapXenditAccountType(account.type),
      status: mapXenditStatus(account.status),
      currency: 'PHP',
      raw: account,
    };
  }

  async getPartnerAccountStatus(accountId: string): Promise<PartnerProviderAccountStatusResult> {
    const payload = await xenditFetch<unknown>(`/v2/accounts/${accountId}`, { method: 'GET', });
    const account = parseXenditAccountPayload(payload);

    return {
      providerAccountId: account.id,
      accountType: mapXenditAccountType(account.type),
      status: mapXenditStatus(account.status),
      currency: 'PHP',
      raw: account,
    };
  }

  async getPartnerBalance(accountId: string): Promise<PartnerProviderBalanceResult> {
    const payload = await xenditFetch<unknown>('/balance?account_type=CASH', {
      method: 'GET',
      accountId,
    });
    const balances = parseXenditBalancePayload(payload);
    const cashBalance =
      balances.find((entry) => entry.type?.toUpperCase() === 'CASH') ??
      balances[0];

    if (!cashBalance) {
      throw new ProviderValidationError('Xendit did not return a cash balance.', 502);
    }

    return {
      availableMinor: cashBalance.balance,
      currency: cashBalance.currency,
      fetchedAt: new Date(),
      raw: cashBalance,
    };
  }

  async createBookingPayment(
    input: CreateProviderBookingPaymentInput
  ): Promise<ProviderBookingPaymentResult> {
    const payload = await xenditFetch<unknown>('/v2/invoices', {
      method: 'POST',
      accountId: input.partnerProviderAccountId,
      headers: { 'Idempotency-Key': input.referenceId, },
      body: JSON.stringify({
        external_id: input.referenceId,
        amount: amountFromMinorUnits(input.amountMinor, input.currency),
        currency: input.currency,
        description: input.description,
        success_redirect_url: input.successUrl,
        failure_redirect_url: input.cancelUrl,
        payer_email: input.customerEmail ?? undefined,
        metadata: input.metadata,
      }),
    });

    const invoice = parseXenditInvoicePayload(payload);

    return {
      paymentId: invoice.id,
      paymentRequestId: invoice.payment_request_id ?? null,
      referenceId: invoice.external_id,
      amountMinor: amountToMinorUnits(invoice.amount, invoice.currency),
      currency: invoice.currency,
      checkoutUrl: invoice.invoice_url,
      status: this.mapInvoiceStatus(invoice.status),
      expiresAt: invoice.expiry_date ?? null,
      isLive: isXenditLiveMode(),
      raw: invoice,
    };
  }

  async getPayment(
    paymentId: string,
    partnerProviderAccountId: string
  ): Promise<ProviderPaymentResult> {
    const payload = await xenditFetch<unknown>(
      `/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        accountId: partnerProviderAccountId,
        headers: { 'api-version': '2024-11-11', },
      }
    );

    const payment = parseXenditPaymentPayload(payload);

    return {
      paymentId: payment.id,
      paymentRequestId: payment.payment_request_id,
      status: payment.status,
      currency: payment.currency,
      amountMinor:
        payment.amount == null
          ? null
          : amountToMinorUnits(payment.amount, payment.currency),
      raw: payment,
    };
  }

  async listPayoutChannels(currency: string): Promise<ProviderPayoutChannel[]> {
    const payload = await xenditFetch<unknown>(
      `/available_disbursements_channels?currency=${encodeURIComponent(currency)}`,
      { method: 'GET', }
    );
    const channels = parseXenditPayoutChannelsPayload(payload);

    return channels.map((channel) => ({
      channelCode: channel.channel_code,
      channelName: channel.channel_name,
      category: mapXenditPayoutChannelCategory(channel.category),
      currency: channel.currency,
      country: channel.country ?? null,
      minimumAmountMinor:
        channel.amount_limits?.minimum != null
          ? amountToMinorUnits(channel.amount_limits.minimum, channel.currency)
          : null,
      maximumAmountMinor:
        channel.amount_limits?.maximum != null
          ? amountToMinorUnits(channel.amount_limits.maximum, channel.currency)
          : null,
      raw: channel,
    }));
  }

  async createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundResult> {
    const payload = await xenditFetch<unknown>('/refunds', {
      method: 'POST',
      accountId: input.partnerProviderAccountId,
      headers: { 'Idempotency-Key': input.referenceId, },
      body: JSON.stringify({
        reference_id: input.referenceId,
        payment_request_id: input.paymentRequestId,
        amount:
          input.amountMinor != null && input.currency
            ? amountFromMinorUnits(input.amountMinor, input.currency)
            : undefined,
        reason: input.reason,
        metadata: input.metadata ?? undefined,
      }),
    });

    const refund = parseXenditRefundPayload(payload);

    return {
      refundId: refund.id,
      referenceId: refund.reference_id,
      paymentId: refund.payment_id ?? null,
      paymentRequestId: refund.payment_request_id,
      amountMinor:
        refund.amount != null && refund.currency
          ? amountToMinorUnits(refund.amount, refund.currency)
          : null,
      currency: refund.currency ?? null,
      status: mapXenditRefundStatus(refund.status),
      failureReason: refund.failure_reason ?? null,
      raw: refund,
    };
  }

  async createPayout(input: CreateProviderPayoutInput): Promise<ProviderPayoutResult> {
    const payload = await xenditFetch<unknown>('/v2/payouts', {
      method: 'POST',
      accountId: input.partnerProviderAccountId,
      headers: { 'Idempotency-Key': input.referenceId, },
      body: JSON.stringify({
        reference_id: input.referenceId,
        amount: amountFromMinorUnits(input.amountMinor, input.currency),
        currency: input.currency,
        channel_code: input.destination.channelCode,
        description: input.description,
        channel_properties: {
          account_number: input.destination.accountNumber,
          account_holder_name: input.destination.accountHolderName,
        },
        metadata: input.metadata ?? undefined,
      }),
    });

    return this.mapPayoutResult(parseXenditPayoutPayload(payload));
  }

  async getPayout(payoutId: string, partnerProviderAccountId: string): Promise<ProviderPayoutResult> {
    const payload = await xenditFetch<unknown>(
      `/v2/payouts/${encodeURIComponent(payoutId)}`,
      {
        method: 'GET',
        accountId: partnerProviderAccountId,
      }
    );

    return this.mapPayoutResult(parseXenditPayoutPayload(payload));
  }

  async getPayoutsByReferenceId(
    referenceId: string,
    partnerProviderAccountId: string
  ): Promise<ProviderPayoutResult[]> {
    const payload = await xenditFetch<unknown>(
      `/v2/payouts?reference_id=${encodeURIComponent(referenceId)}`,
      {
        method: 'GET',
        accountId: partnerProviderAccountId,
      }
    );

    return parseXenditPayoutListPayload(payload).map((entry) => this.mapPayoutResult(entry));
  }
}
