import { Prisma } from '@prisma/client';

import { recordPartnerWalletSnapshot } from '@/lib/financial/wallet-snapshots';
import { prisma } from '@/lib/prisma';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import { formatCurrencyMinor } from '@/lib/wallet';

type XenditPayoutState = {
  payoutId: string | null;
  referenceId: string;
  status: string;
  estimatedArrivalTime: string | null;
  failureCode: string | null;
};

function isJsonObject(value: Prisma.JsonValue | null | unknown): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildProviderWebhookMetadata(
  metadata: Prisma.JsonValue | null,
  details: {
    workflowStage: 'submitted_to_provider' | 'succeeded' | 'failed';
    providerStatus: string;
    estimatedArrivalTime: string | null;
    failureCode: string | null;
  }
): Prisma.InputJsonValue {
  const base = isJsonObject(metadata) ? metadata : {};
  const previousProvider =
    base.payout_provider && typeof base.payout_provider === 'object' && !Array.isArray(base.payout_provider)
      ? (base.payout_provider as Prisma.JsonObject)
      : {};

  return {
    ...base,
    workflow_stage: details.workflowStage,
    payout_provider: {
      ...previousProvider,
      status: details.providerStatus,
      estimated_arrival_time: details.estimatedArrivalTime,
      failure_code: details.failureCode,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function syncPartnerWalletFromRemoteAccountId(remoteAccountId: string | null) {
  if (!remoteAccountId) {
    return;
  }

  const localAccount = await prisma.partner_provider_account.findFirst({
    where: {
      provider: 'xendit',
      provider_account_id: remoteAccountId,
    },
    select: {
      id: true,
      partner_user_id: true,
    },
  });

  if (!localAccount) {
    return;
  }

  const provider = getFinancialProvider();
  const balance = await provider.getPartnerBalance(remoteAccountId);

  await recordPartnerWalletSnapshot({
    partnerUserId: localAccount.partner_user_id,
    partnerProviderAccountId: localAccount.id,
    availableBalanceMinor: balance.availableMinor,
    currency: balance.currency,
    fetchedAt: balance.fetchedAt,
  });
}

export async function applyXenditPayoutStatus(payout: XenditPayoutState) {
  let providerAccountIdToSync: string | null = null;
  let changed = false;

  await prisma.$transaction(async (tx) => {
    const payoutRequest = await tx.wallet_transaction.findUnique({
      where: { id: payout.referenceId, },
      select: {
        id: true,
        wallet_id: true,
        type: true,
        status: true,
        amount_minor: true,
        currency: true,
        metadata: true,
        wallet: { select: { user: { select: { auth_user_id: true, }, }, }, },
      },
    });

    if (!payoutRequest || payoutRequest.type !== 'payout') {
      return;
    }

    const metadata = isJsonObject(payoutRequest.metadata) ? payoutRequest.metadata : null;
    const providerSnapshot =
      metadata?.provider_account_snapshot && isJsonObject(metadata.provider_account_snapshot)
        ? metadata.provider_account_snapshot
        : null;
    providerAccountIdToSync =
      providerSnapshot && typeof providerSnapshot.provider_account_id === 'string'
        ? providerSnapshot.provider_account_id
        : null;

    if (payout.status === 'SUCCEEDED') {
      if (payoutRequest.status === 'succeeded') {
        return;
      }

      changed = true;
      await tx.wallet_transaction.update({
        where: { id: payoutRequest.id, },
        data: {
          status: 'succeeded',
          external_reference: payout.payoutId ?? undefined,
          metadata: buildProviderWebhookMetadata(payoutRequest.metadata, {
            workflowStage: 'succeeded',
            providerStatus: payout.status,
            estimatedArrivalTime: payout.estimatedArrivalTime,
            failureCode: payout.failureCode,
          }),
          updated_at: new Date(),
        },
      });

      const amountLabel = formatCurrencyMinor(
        payoutRequest.amount_minor.toString(),
        payoutRequest.currency
      );
      await tx.app_notification.create({
        data: {
          user_auth_id: payoutRequest.wallet.user.auth_user_id,
          title: 'Payout completed',
          body: `Your payout request for ${amountLabel} has been completed by Xendit.`,
          href: '/partner/wallet',
          type: 'system',
        },
      });
      return;
    }

    if (
      payout.status === 'FAILED' ||
      payout.status === 'CANCELLED' ||
      payout.status === 'REVERSED'
    ) {
      if (payoutRequest.status === 'failed') {
        return;
      }

      changed = true;
      await tx.wallet_transaction.update({
        where: { id: payoutRequest.id, },
        data: {
          status: 'failed',
          external_reference: payout.payoutId ?? undefined,
          metadata: buildProviderWebhookMetadata(payoutRequest.metadata, {
            workflowStage: 'failed',
            providerStatus: payout.status,
            estimatedArrivalTime: payout.estimatedArrivalTime,
            failureCode: payout.failureCode,
          }),
          updated_at: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: payoutRequest.wallet_id, },
        data: {
          balance_minor: { increment: payoutRequest.amount_minor, },
          updated_at: new Date(),
        },
      });

      const amountLabel = formatCurrencyMinor(
        payoutRequest.amount_minor.toString(),
        payoutRequest.currency
      );
      const failureSuffix = payout.failureCode ? ` Code: ${payout.failureCode}.` : '';
      await tx.app_notification.create({
        data: {
          user_auth_id: payoutRequest.wallet.user.auth_user_id,
          title: 'Payout failed',
          body: `Your payout request for ${amountLabel} could not be completed by Xendit. The funds are available in your wallet again.${failureSuffix}`,
          href: '/partner/wallet',
          type: 'system',
        },
      });
      return;
    }

    changed = true;
    await tx.wallet_transaction.update({
      where: { id: payoutRequest.id, },
      data: {
        external_reference: payout.payoutId ?? undefined,
        metadata: buildProviderWebhookMetadata(payoutRequest.metadata, {
          workflowStage: 'submitted_to_provider',
          providerStatus: payout.status,
          estimatedArrivalTime: payout.estimatedArrivalTime,
          failureCode: payout.failureCode,
        }),
        updated_at: new Date(),
      },
    });
  }, { isolationLevel: 'Serializable', });

  return {
    changed,
    providerAccountIdToSync,
  };
}
