import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ensureWalletRow } from '@/lib/wallet-server';

type RecordPartnerWalletSnapshotInput = {
  partnerUserId: bigint;
  partnerProviderAccountId: string;
  availableBalanceMinor: bigint;
  currency: string;
  fetchedAt: Date;
};

type RecordPartnerWalletSnapshotFailureInput = {
  partnerUserId: bigint;
  partnerProviderAccountId: string;
  currency: string;
  failureReason: string;
  fetchedAt: Date;
};

function clampToZero(value: bigint) {
  return value >= 0n ? value : 0n;
}

function mergeMetadata(
  current: Prisma.JsonValue | null | undefined,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    return patch;
  }

  return {
    ...current,
    ...patch,
  };
}

export async function recordPartnerWalletSnapshot(
  input: RecordPartnerWalletSnapshotInput
) {
  const walletRow = await ensureWalletRow(input.partnerUserId);

  return prisma.$transaction(async (tx) => {
    const pendingPayouts = await tx.wallet_transaction.aggregate({
      where: {
        wallet_id: walletRow.id,
        type: 'payout',
        status: 'pending',
      },
      _sum: { amount_minor: true, },
    });

    const pendingReserveMinor = pendingPayouts._sum.amount_minor ?? 0n;
    const derivedWalletBalanceMinor = clampToZero(
      input.availableBalanceMinor - pendingReserveMinor
    );

    const snapshot = await tx.partner_wallet_snapshot.create({
      data: {
        partner_user_id: input.partnerUserId,
        partner_provider_account_id: input.partnerProviderAccountId,
        available_balance_minor: input.availableBalanceMinor,
        currency: input.currency,
        sync_status: 'synced',
        fetched_at: input.fetchedAt,
      },
    });

    await tx.wallet.update({
      where: { id: walletRow.id, },
      data: {
        balance_minor: derivedWalletBalanceMinor,
        currency: input.currency,
        updated_at: input.fetchedAt,
      },
    });

    await tx.partner_provider_account.update({
      where: { id: input.partnerProviderAccountId, },
      data: {
        currency: input.currency,
        last_synced_at: input.fetchedAt,
        metadata: mergeMetadata(
          (
            await tx.partner_provider_account.findUnique({
              where: { id: input.partnerProviderAccountId, },
              select: { metadata: true, },
            })
          )?.metadata,
          {
            last_balance_snapshot: {
              amount_minor: input.availableBalanceMinor.toString(),
              currency: input.currency,
              fetched_at: input.fetchedAt.toISOString(),
              pending_payout_reserve_minor: pendingReserveMinor.toString(),
              derived_wallet_balance_minor: derivedWalletBalanceMinor.toString(),
            },
          }
        ),
        updated_at: new Date(),
      },
    });

    return {
      snapshot,
      pendingReserveMinor,
      derivedWalletBalanceMinor,
    };
  }, { isolationLevel: 'Serializable', });
}

export async function recordPartnerWalletSnapshotFailure(
  input: RecordPartnerWalletSnapshotFailureInput
) {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.partner_wallet_snapshot.create({
      data: {
        partner_user_id: input.partnerUserId,
        partner_provider_account_id: input.partnerProviderAccountId,
        available_balance_minor: BigInt(0),
        currency: input.currency,
        sync_status: 'failed',
        failure_reason: input.failureReason,
        fetched_at: input.fetchedAt,
      },
    });

    const existingMetadata = await tx.partner_provider_account.findUnique({
      where: { id: input.partnerProviderAccountId, },
      select: { metadata: true, },
    });

    await tx.partner_provider_account.update({
      where: { id: input.partnerProviderAccountId, },
      data: {
        last_synced_at: input.fetchedAt,
        metadata: mergeMetadata(
          existingMetadata?.metadata,
          {
            last_balance_snapshot_failure: {
              failure_reason: input.failureReason,
              fetched_at: input.fetchedAt.toISOString(),
            },
          }
        ),
        updated_at: new Date(),
      },
    });

    return snapshot;
  }, { isolationLevel: 'Serializable', });
}
