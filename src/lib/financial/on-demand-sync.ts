import { applyXenditPayoutStatus, syncPartnerWalletFromRemoteAccountId } from '@/lib/financial/xendit-payouts';
import { prisma } from '@/lib/prisma';
import { getFinancialProvider } from '@/lib/providers/provider-registry';

/**
 * Reconcile pending payouts for a specific partner on-demand.
 *
 * Checks each pending payout against Xendit to detect status changes
 * that may have been missed by webhooks. Balance refreshes update the
 * provider account sync timestamp too, so pending payouts must be
 * reconciled independently of snapshot freshness.
 */
export async function reconcilePendingPayouts(partnerUserId: bigint) {
  const account = await prisma.partner_provider_account.findFirst({
    where: {
      partner_user_id: partnerUserId,
      provider: 'xendit',
      provider_account_id: { not: null, },
      status: 'live',
    },
    select: {
      id: true,
      provider_account_id: true,
      last_synced_at: true,
      partner: { select: { wallet: { select: { id: true, }, }, }, },
    },
  });

  if (!account?.provider_account_id || !account.partner.wallet?.id) {
    return;
  }

  const pendingPayouts = await prisma.wallet_transaction.findMany({
    where: {
      wallet_id: account.partner.wallet.id,
      type: 'payout',
      status: 'pending',
      external_reference: { not: null, },
    },
    select: {
      id: true,
      external_reference: true,
    },
  });

  if (pendingPayouts.length === 0) {
    return;
  }

  const provider = getFinancialProvider();
  let anyChanged = false;

  for (const payout of pendingPayouts) {
    if (!payout.external_reference) continue;

    try {
      const providerPayout = await provider.getPayout(
        payout.external_reference,
        account.provider_account_id
      );
      const result = await applyXenditPayoutStatus({
        payoutId: providerPayout.payoutId,
        referenceId: payout.id,
        status: providerPayout.status,
        estimatedArrivalTime: providerPayout.estimatedArrivalTime,
        failureCode: providerPayout.failureCode,
      });

      if (result?.changed) {
        anyChanged = true;
      }
    } catch (error) {
      console.error('Failed to reconcile payout on-demand', {
        payoutId: payout.id,
        externalReference: payout.external_reference,
        error,
      });
    }
  }

  if (anyChanged) {
    try {
      await syncPartnerWalletFromRemoteAccountId(account.provider_account_id);
    } catch (error) {
      console.error('Failed to sync wallet after on-demand payout reconciliation', {
        providerAccountId: account.provider_account_id,
        error,
      });
    }
  }
}
