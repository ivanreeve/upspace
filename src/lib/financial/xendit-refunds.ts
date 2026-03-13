import { Prisma } from '@prisma/client';

import { recordPartnerWalletSnapshot } from '@/lib/financial/wallet-snapshots';
import { prisma } from '@/lib/prisma';
import { FinancialProviderError, ProviderValidationError } from '@/lib/providers/errors';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import type { ProviderRefundResult } from '@/lib/providers/types';

type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other' | 'cancellation';

type XenditRefundContext = {
  localPartnerProviderAccountId: string;
  remotePartnerProviderAccountId: string;
  paymentId: string | null;
  paymentRequestId: string;
};

type CreateXenditRefundInput = {
  walletTransactionId: string;
  partnerUserId: bigint;
  bookingId: string;
  paymentTransaction: {
    id: string;
    provider_object_id: string;
    amount_minor: bigint;
    currency_iso3: string;
    raw_gateway_json: Prisma.JsonValue | null;
  };
  amountMinor: bigint;
  reason: RefundReason;
  requestedByAuthUserId: string | null;
  metadata?: Record<string, string>;
  providedPaymentReference?: string | null;
};

function isJsonObject(value: Prisma.JsonValue | null | unknown): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonString(
  value: Prisma.JsonValue | null | unknown,
  key: string
) {
  if (!isJsonObject(value)) {
    return null;
  }

  const candidate = value[key];
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : null;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapRefundReason(reason: RefundReason) {
  switch (reason) {
    case 'duplicate':
      return 'DUPLICATE' as const;
    case 'fraudulent':
      return 'FRAUDULENT' as const;
    case 'requested_by_customer':
      return 'REQUESTED_BY_CUSTOMER' as const;
    case 'cancellation':
      return 'CANCELLATION' as const;
    case 'other':
    default:
      return 'OTHERS' as const;
  }
}

function mergeRefundMetadata(
  current: Prisma.JsonValue | null,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonValue {
  return {
    ...(isJsonObject(current) ? current : {}),
    ...patch,
  };
}

function mapRefundTransactionStatus(status: ProviderRefundResult['status']) {
  switch (status) {
    case 'SUCCEEDED':
      return 'succeeded' as const;
    case 'FAILED':
    case 'CANCELLED':
      return 'failed' as const;
    case 'PENDING':
    default:
      return 'pending' as const;
  }
}

async function resolveRefundContext(input: {
  partnerUserId: bigint;
  paymentTransaction: CreateXenditRefundInput['paymentTransaction'];
  providedPaymentReference?: string | null;
}) {
  const provider = getFinancialProvider();
  const localAccountId =
    readJsonString(input.paymentTransaction.raw_gateway_json, 'partner_provider_account_id');

  const localPartnerProviderAccount = localAccountId
    ? await prisma.partner_provider_account.findUnique({
      where: { id: localAccountId, },
      select: {
 id: true,
provider_account_id: true, 
},
    })
    : await prisma.partner_provider_account.findFirst({
      where: {
        partner_user_id: input.partnerUserId,
        provider: 'xendit',
      },
      select: {
 id: true,
provider_account_id: true, 
},
    });

  if (!localPartnerProviderAccount?.provider_account_id) {
    throw new ProviderValidationError(
      'The partner payout account is not ready for Xendit refunds.',
      409
    );
  }

  const directPaymentRequestId =
    readJsonString(input.paymentTransaction.raw_gateway_json, 'payment_request_id') ||
    (input.providedPaymentReference?.startsWith('pr-')
      ? input.providedPaymentReference.trim()
      : null);

  if (directPaymentRequestId) {
    return {
      localPartnerProviderAccountId: localPartnerProviderAccount.id,
      remotePartnerProviderAccountId: localPartnerProviderAccount.provider_account_id,
      paymentId:
        readJsonString(input.paymentTransaction.raw_gateway_json, 'payment_id') ||
        (input.providedPaymentReference?.startsWith('py-')
          ? input.providedPaymentReference.trim()
          : null),
      paymentRequestId: directPaymentRequestId,
    } satisfies XenditRefundContext;
  }

  const paymentId =
    readJsonString(input.paymentTransaction.raw_gateway_json, 'payment_id') ||
    (input.providedPaymentReference?.startsWith('py-')
      ? input.providedPaymentReference.trim()
      : null);

  if (!paymentId) {
    throw new ProviderValidationError(
      'The original Xendit payment reference is incomplete, so this booking cannot be refunded yet.',
      409
    );
  }

  const payment = await provider.getPayment(
    paymentId,
    localPartnerProviderAccount.provider_account_id
  );

  return {
    localPartnerProviderAccountId: localPartnerProviderAccount.id,
    remotePartnerProviderAccountId: localPartnerProviderAccount.provider_account_id,
    paymentId: payment.paymentId,
    paymentRequestId: payment.paymentRequestId,
  } satisfies XenditRefundContext;
}

export async function syncPartnerWalletAfterXenditRefund(input: {
  partnerUserId: bigint;
  localPartnerProviderAccountId: string;
  remotePartnerProviderAccountId: string;
}) {
  const provider = getFinancialProvider();
  const balance = await provider.getPartnerBalance(input.remotePartnerProviderAccountId);

  await recordPartnerWalletSnapshot({
    partnerUserId: input.partnerUserId,
    partnerProviderAccountId: input.localPartnerProviderAccountId,
    availableBalanceMinor: balance.availableMinor,
    currency: balance.currency,
    fetchedAt: balance.fetchedAt,
  });
}

export async function submitXenditRefund(input: CreateXenditRefundInput) {
  const context = await resolveRefundContext({
    partnerUserId: input.partnerUserId,
    paymentTransaction: input.paymentTransaction,
    providedPaymentReference: input.providedPaymentReference,
  });

  const provider = getFinancialProvider();

  try {
    const providerRefund = await provider.createRefund({
      partnerProviderAccountId: context.remotePartnerProviderAccountId,
      referenceId: input.walletTransactionId,
      paymentRequestId: context.paymentRequestId,
      amountMinor: input.amountMinor,
      currency: input.paymentTransaction.currency_iso3,
      reason: mapRefundReason(input.reason),
      metadata: {
        booking_id: input.bookingId,
        wallet_transaction_id: input.walletTransactionId,
        payment_transaction_id: input.paymentTransaction.id,
        ...(input.requestedByAuthUserId
          ? { requested_by: input.requestedByAuthUserId, }
          : {}),
        ...(input.metadata ?? {}),
      },
    });

    const resolvedStatus = mapRefundTransactionStatus(providerRefund.status);
    const isFullRefund = input.amountMinor >= input.paymentTransaction.amount_minor;

    const updatedTransaction = await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet_transaction.update({
        where: { id: input.walletTransactionId, },
        data: {
          status: resolvedStatus,
          external_reference: providerRefund.refundId,
          currency: providerRefund.currency ?? input.paymentTransaction.currency_iso3,
          amount_minor: providerRefund.amountMinor ?? input.amountMinor,
          net_amount_minor: providerRefund.amountMinor ?? input.amountMinor,
          metadata: mergeRefundMetadata(
            (
              await tx.wallet_transaction.findUnique({
                where: { id: input.walletTransactionId, },
                select: { metadata: true, },
              })
            )?.metadata ?? null,
            {
              provider: 'xendit',
              payment_transaction_id: input.paymentTransaction.id,
              payment_provider_object_id: input.paymentTransaction.provider_object_id,
              payment_id: context.paymentId,
              payment_request_id: context.paymentRequestId,
              local_partner_provider_account_id: context.localPartnerProviderAccountId,
              remote_partner_provider_account_id: context.remotePartnerProviderAccountId,
              requested_by: input.requestedByAuthUserId,
              failure_reason: providerRefund.failureReason,
              provider_refund: toInputJsonValue(providerRefund.raw),
            }
          ),
          updated_at: new Date(),
        },
      });

      if (resolvedStatus === 'succeeded' && isFullRefund) {
        await tx.payment_transaction.update({
          where: { id: input.paymentTransaction.id, },
          data: {
            status: 'refunded',
            updated_at: new Date(),
            raw_gateway_json: mergeRefundMetadata(input.paymentTransaction.raw_gateway_json, {
              latest_refund_id: providerRefund.refundId,
              latest_refund_status: providerRefund.status,
            }),
          },
        });
      }

      return updated;
    }, { isolationLevel: 'Serializable', });

    if (resolvedStatus !== 'pending') {
      await syncPartnerWalletAfterXenditRefund({
        partnerUserId: input.partnerUserId,
        localPartnerProviderAccountId: context.localPartnerProviderAccountId,
        remotePartnerProviderAccountId: context.remotePartnerProviderAccountId,
      });
    }

    return {
      context,
      providerRefund,
      transaction: updatedTransaction,
    };
  } catch (error) {
    if (error instanceof FinancialProviderError && error.code === 'provider_conflict_error') {
      const updatedTransaction = await prisma.wallet_transaction.update({
        where: { id: input.walletTransactionId, },
        data: {
          status: 'pending',
          metadata: mergeRefundMetadata(
            (
              await prisma.wallet_transaction.findUnique({
                where: { id: input.walletTransactionId, },
                select: { metadata: true, },
              })
            )?.metadata ?? null,
            {
              provider: 'xendit',
              payment_transaction_id: input.paymentTransaction.id,
              payment_provider_object_id: input.paymentTransaction.provider_object_id,
              payment_id: context.paymentId,
              payment_request_id: context.paymentRequestId,
              local_partner_provider_account_id: context.localPartnerProviderAccountId,
              remote_partner_provider_account_id: context.remotePartnerProviderAccountId,
              submission_conflict: true,
            }
          ),
          updated_at: new Date(),
        },
      });

      return {
        context,
        providerRefund: null,
        transaction: updatedTransaction,
      };
    }

    await prisma.wallet_transaction.update({
      where: { id: input.walletTransactionId, },
      data: {
        status: 'failed',
        metadata: mergeRefundMetadata(
          (
            await prisma.wallet_transaction.findUnique({
              where: { id: input.walletTransactionId, },
              select: { metadata: true, },
            })
          )?.metadata ?? null,
          {
            provider: 'xendit',
            payment_transaction_id: input.paymentTransaction.id,
            payment_provider_object_id: input.paymentTransaction.provider_object_id,
            failure_reason: error instanceof Error ? error.message : 'Xendit refund failed.',
          }
        ),
        updated_at: new Date(),
      },
    }).catch((updateError) => {
      console.error('Failed to mark Xendit refund as failed locally', {
        walletTransactionId: input.walletTransactionId,
        updateError,
      });
    });

    throw error;
  }
}
