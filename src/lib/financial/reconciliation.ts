import { Prisma } from '@prisma/client';

import { recordPartnerWalletSnapshotFailure } from '@/lib/financial/wallet-snapshots';
import { applyXenditPayoutStatus, syncPartnerWalletFromRemoteAccountId } from '@/lib/financial/xendit-payouts';
import { prisma } from '@/lib/prisma';
import { getFinancialProvider } from '@/lib/providers/provider-registry';

export const PROVIDER_RECONCILIATION_STALE_MS = 15 * 60 * 1000;
const DEFAULT_RECONCILIATION_LIMIT = 50;

type ProviderAccountRow = {
  id: string;
  partner_user_id: bigint;
  provider_account_id: string | null;
  status: string;
  currency: string;
  metadata: Prisma.JsonValue | null;
  last_synced_at: Date | null;
  partner: {
    handle: string;
    first_name: string | null;
    last_name: string | null;
    wallet: {
      id: string;
      balance_minor: bigint;
      currency: string;
    } | null;
  };
  wallet_snapshots: Array<{
    available_balance_minor: bigint;
    currency: string;
    sync_status: 'synced' | 'failed';
    failure_reason: string | null;
    fetched_at: Date;
  }>;
};

export type AdminReconciliationRow = {
  partnerUserId: string;
  partnerHandle: string;
  partnerName: string | null;
  localProviderAccountId: string;
  remoteProviderAccountId: string | null;
  providerStatus: string;
  walletBalanceMinor: string;
  walletCurrency: string | null;
  providerAvailableBalanceMinor: string | null;
  providerCurrency: string | null;
  expectedWalletBalanceMinor: string | null;
  pendingPayoutReserveMinor: string;
  pendingRefundCount: number;
  pendingProviderPayoutCount: number;
  mismatchMinor: string | null;
  lastSyncedAt: string | null;
  latestSnapshotFetchedAt: string | null;
  latestSnapshotStatus: 'synced' | 'failed' | null;
  latestFailureReason: string | null;
  health: 'healthy' | 'stale' | 'failed' | 'action_required';
};

export type AdminReconciliationSummary = {
  totalAccounts: number;
  liveAccounts: number;
  staleAccounts: number;
  failedAccounts: number;
  mismatchedAccounts: number;
  pendingProviderPayouts: number;
  pendingRefunds: number;
};

export type ProviderReconciliationRunSummary = {
  checkedAccounts: number;
  syncedAccounts: number;
  failedAccounts: number;
  reconciledPayouts: number;
  staleAccountsBeforeRun: number;
};

function isJsonObject(value: Prisma.JsonValue | null | unknown): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonValue {
  return {
    ...(isJsonObject(current) ? current : {}),
    ...patch,
  };
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatPartnerName(account: ProviderAccountRow['partner']) {
  const fullName = [account.first_name, account.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();

  return fullName || null;
}

function clampToZero(value: bigint) {
  return value >= 0n ? value : 0n;
}

function deriveHealth(input: {
  status: string;
  latestSnapshotStatus: 'synced' | 'failed' | null;
  lastSyncedAt: Date | null;
  mismatchMinor: bigint | null;
}) {
  if (input.status !== 'live') {
    return 'action_required' as const;
  }

  if (input.latestSnapshotStatus === 'failed') {
    return 'failed' as const;
  }

  if (
    input.lastSyncedAt &&
    Date.now() - input.lastSyncedAt.getTime() > PROVIDER_RECONCILIATION_STALE_MS
  ) {
    return 'stale' as const;
  }

  if (input.mismatchMinor !== null && input.mismatchMinor !== 0n) {
    return 'failed' as const;
  }

  return 'healthy' as const;
}

async function loadProviderAccounts(limit = DEFAULT_RECONCILIATION_LIMIT) {
  return prisma.partner_provider_account.findMany({
    where: { provider: 'xendit', },
    orderBy: [
      { last_synced_at: 'asc', },
      { created_at: 'desc', }
    ],
    take: limit,
    select: {
      id: true,
      partner_user_id: true,
      provider_account_id: true,
      status: true,
      currency: true,
      metadata: true,
      last_synced_at: true,
      partner: {
        select: {
          handle: true,
          first_name: true,
          last_name: true,
          wallet: {
            select: {
              id: true,
              balance_minor: true,
              currency: true,
            },
          },
        },
      },
      wallet_snapshots: {
        take: 1,
        orderBy: { fetched_at: 'desc', },
        select: {
          available_balance_minor: true,
          currency: true,
          sync_status: true,
          failure_reason: true,
          fetched_at: true,
        },
      },
    },
  });
}

async function loadWalletAggregates(walletIds: string[]) {
  if (!walletIds.length) {
    return {
      pendingPayouts: new Map<string, bigint>(),
      pendingProviderPayouts: new Map<string, number>(),
      pendingRefunds: new Map<string, number>(),
    };
  }

  const [pendingPayouts, pendingProviderPayouts, pendingRefunds] = await Promise.all([
    prisma.wallet_transaction.groupBy({
      by: ['wallet_id'],
      where: {
        wallet_id: { in: walletIds, },
        type: 'payout',
        status: 'pending',
      },
      _sum: { amount_minor: true, },
    }),
    prisma.wallet_transaction.groupBy({
      by: ['wallet_id'],
      where: {
        wallet_id: { in: walletIds, },
        type: 'payout',
        status: 'pending',
        metadata: {
          path: ['workflow_stage'],
          equals: 'submitted_to_provider',
        },
      },
      _count: { _all: true, },
    }),
    prisma.wallet_transaction.groupBy({
      by: ['wallet_id'],
      where: {
        wallet_id: { in: walletIds, },
        type: 'refund',
        status: 'pending',
      },
      _count: { _all: true, },
    })
  ]);

  return {
    pendingPayouts: new Map(
      pendingPayouts.map((entry) => [entry.wallet_id, entry._sum.amount_minor ?? 0n])
    ),
    pendingProviderPayouts: new Map(
      pendingProviderPayouts.map((entry) => [entry.wallet_id, entry._count._all])
    ),
    pendingRefunds: new Map(
      pendingRefunds.map((entry) => [entry.wallet_id, entry._count._all])
    ),
  };
}

function mapAccountToRow(
  account: ProviderAccountRow,
  aggregates: {
    pendingPayoutReserveMinor: bigint;
    pendingProviderPayoutCount: number;
    pendingRefundCount: number;
  }
): AdminReconciliationRow {
  const latestSnapshot = account.wallet_snapshots[0] ?? null;
  const providerAvailableBalanceMinor = latestSnapshot?.available_balance_minor ?? null;
  const expectedWalletBalanceMinor =
    providerAvailableBalanceMinor !== null
      ? clampToZero(providerAvailableBalanceMinor - aggregates.pendingPayoutReserveMinor)
      : null;
  const walletBalanceMinor = account.partner.wallet?.balance_minor ?? 0n;
  const mismatchMinor =
    expectedWalletBalanceMinor === null
      ? null
      : walletBalanceMinor - expectedWalletBalanceMinor;
  const health = deriveHealth({
    status: account.status,
    latestSnapshotStatus: latestSnapshot?.sync_status ?? null,
    lastSyncedAt: account.last_synced_at,
    mismatchMinor,
  });

  return {
    partnerUserId: account.partner_user_id.toString(),
    partnerHandle: account.partner.handle,
    partnerName: formatPartnerName(account.partner),
    localProviderAccountId: account.id,
    remoteProviderAccountId: account.provider_account_id,
    providerStatus: account.status,
    walletBalanceMinor: walletBalanceMinor.toString(),
    walletCurrency: account.partner.wallet?.currency ?? null,
    providerAvailableBalanceMinor: providerAvailableBalanceMinor?.toString() ?? null,
    providerCurrency: latestSnapshot?.currency ?? null,
    expectedWalletBalanceMinor: expectedWalletBalanceMinor?.toString() ?? null,
    pendingPayoutReserveMinor: aggregates.pendingPayoutReserveMinor.toString(),
    pendingRefundCount: aggregates.pendingRefundCount,
    pendingProviderPayoutCount: aggregates.pendingProviderPayoutCount,
    mismatchMinor: mismatchMinor?.toString() ?? null,
    lastSyncedAt: account.last_synced_at?.toISOString() ?? null,
    latestSnapshotFetchedAt: latestSnapshot?.fetched_at.toISOString() ?? null,
    latestSnapshotStatus: latestSnapshot?.sync_status ?? null,
    latestFailureReason: latestSnapshot?.failure_reason ?? null,
    health,
  };
}

export async function listAdminReconciliationData(limit = DEFAULT_RECONCILIATION_LIMIT) {
  const accounts = await loadProviderAccounts(limit);
  const walletIds = accounts
    .map((account) => account.partner.wallet?.id ?? null)
    .filter((walletId): walletId is string => Boolean(walletId));

  const aggregates = await loadWalletAggregates(walletIds);
  const rows = accounts.map((account) => mapAccountToRow(account, {
    pendingPayoutReserveMinor: account.partner.wallet
      ? (aggregates.pendingPayouts.get(account.partner.wallet.id) ?? 0n)
      : 0n,
    pendingProviderPayoutCount: account.partner.wallet
      ? (aggregates.pendingProviderPayouts.get(account.partner.wallet.id) ?? 0)
      : 0,
    pendingRefundCount: account.partner.wallet
      ? (aggregates.pendingRefunds.get(account.partner.wallet.id) ?? 0)
      : 0,
  }));

  const summary: AdminReconciliationSummary = {
    totalAccounts: rows.length,
    liveAccounts: rows.filter((row) => row.providerStatus === 'live').length,
    staleAccounts: rows.filter((row) => row.health === 'stale').length,
    failedAccounts: rows.filter((row) => row.health === 'failed').length,
    mismatchedAccounts: rows.filter((row) => row.mismatchMinor !== null && row.mismatchMinor !== '0').length,
    pendingProviderPayouts: rows.reduce((sum, row) => sum + row.pendingProviderPayoutCount, 0),
    pendingRefunds: rows.reduce((sum, row) => sum + row.pendingRefundCount, 0),
  };

  return {
 rows,
summary, 
};
}

export async function runProviderReconciliation(limit = DEFAULT_RECONCILIATION_LIMIT) {
  const accounts = await prisma.partner_provider_account.findMany({
    where: {
      provider: 'xendit',
      provider_account_id: { not: null, },
    },
    orderBy: [
      { last_synced_at: 'asc', },
      { created_at: 'desc', }
    ],
    take: limit,
    select: {
      id: true,
      partner_user_id: true,
      provider_account_id: true,
      status: true,
      currency: true,
      metadata: true,
      last_synced_at: true,
      partner: { select: { wallet: { select: { id: true, }, }, }, },
    },
  });

  const provider = getFinancialProvider();
  const now = new Date();
  let syncedAccounts = 0;
  let failedAccounts = 0;
  let reconciledPayouts = 0;
  let staleAccountsBeforeRun = 0;

  for (const account of accounts) {
    if (
      !account.last_synced_at ||
      now.getTime() - account.last_synced_at.getTime() > PROVIDER_RECONCILIATION_STALE_MS
    ) {
      staleAccountsBeforeRun += 1;
    }

    if (!account.provider_account_id) {
      continue;
    }

    try {
      const remoteAccount = await provider.getPartnerAccountStatus(account.provider_account_id);
      await prisma.partner_provider_account.update({
        where: { id: account.id, },
        data: {
          status: remoteAccount.status,
          provider_account_type: remoteAccount.accountType,
          currency: remoteAccount.currency,
          metadata: mergeMetadata(account.metadata, {
            last_remote_account: toInputJsonValue(remoteAccount.raw),
            last_reconciliation_at: now.toISOString(),
            last_reconciliation_error: null,
          }),
          last_synced_at: now,
          updated_at: new Date(),
        },
      });

      if (remoteAccount.status === 'live') {
        await syncPartnerWalletFromRemoteAccountId(account.provider_account_id);
      }

      if (account.partner.wallet?.id && remoteAccount.status === 'live') {
        let payoutStateChanged = false;
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

        for (const payout of pendingPayouts) {
          if (!payout.external_reference) {
            continue;
          }

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
            reconciledPayouts += 1;
            payoutStateChanged = true;
          }
        }

        if (payoutStateChanged) {
          await syncPartnerWalletFromRemoteAccountId(account.provider_account_id);
        }
      }

      syncedAccounts += 1;
    } catch (error) {
      failedAccounts += 1;

      await recordPartnerWalletSnapshotFailure({
        partnerUserId: account.partner_user_id,
        partnerProviderAccountId: account.id,
        currency: account.currency,
        failureReason: error instanceof Error ? error.message : 'Provider reconciliation failed.',
        fetchedAt: new Date(),
      }).catch((snapshotError) => {
        console.error('Failed to record provider reconciliation snapshot failure', {
          partnerProviderAccountId: account.id,
          snapshotError,
        });
      });

      await prisma.partner_provider_account.update({
        where: { id: account.id, },
        data: {
          metadata: mergeMetadata(account.metadata, {
            last_reconciliation_at: now.toISOString(),
            last_reconciliation_error: error instanceof Error ? error.message : 'Provider reconciliation failed.',
          }),
          updated_at: new Date(),
        },
      }).catch((updateError) => {
        console.error('Failed to update provider reconciliation error metadata', {
          partnerProviderAccountId: account.id,
          updateError,
        });
      });
    }
  }

  return {
    checkedAccounts: accounts.length,
    syncedAccounts,
    failedAccounts,
    reconciledPayouts,
    staleAccountsBeforeRun,
  } satisfies ProviderReconciliationRunSummary;
}
