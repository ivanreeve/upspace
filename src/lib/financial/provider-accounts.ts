import { Prisma, type partner_provider_account } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { maskProviderAccountReference, type PartnerProviderAccountView } from '@/lib/financial/provider-account-view';
import { recordPartnerWalletSnapshot } from '@/lib/financial/wallet-snapshots';
import { FinancialProviderError, ProviderConfigError, ProviderValidationError } from '@/lib/providers/errors';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import type { ProviderAccountStatus } from '@/lib/providers/types';

const PROVIDER_BALANCE_SYNC_WINDOW_MS = 60_000;

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMetadata(
  current: Prisma.JsonValue | null | undefined,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  return {
    ...(isJsonObject(current) ? current : {}),
    ...patch,
  };
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildDisplayName(user: {
  first_name: string | null;
  last_name: string | null;
  handle: string;
}) {
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();

  return fullName || user.handle;
}

function mapSetupState(status: ProviderAccountStatus | null) {
  if (!status) {
    return 'not_enabled' as const;
  }

  switch (status) {
    case 'creating':
      return 'creating' as const;
    case 'live':
      return 'ready' as const;
    case 'error':
      return 'error' as const;
    case 'invited':
    case 'registered':
    case 'awaiting_docs':
    case 'pending_verification':
    case 'suspended':
      return 'action_required' as const;
  }
}

function buildStatusLabel(status: ProviderAccountStatus | null) {
  switch (status) {
    case 'creating':
      return 'Setting up';
    case 'invited':
      return 'Invited';
    case 'registered':
      return 'Registered';
    case 'awaiting_docs':
      return 'Awaiting docs';
    case 'pending_verification':
      return 'Pending review';
    case 'live':
      return 'Ready';
    case 'suspended':
      return 'Suspended';
    case 'error':
      return 'Setup failed';
    default:
      return 'Not enabled';
  }
}

function buildStatusMessage(status: ProviderAccountStatus | null) {
  switch (status) {
    case 'creating':
      return 'Your payout provider account is being prepared. Refresh in a moment if this state persists.';
    case 'invited':
    case 'registered':
    case 'awaiting_docs':
    case 'pending_verification':
      return 'Your payout provider account exists, but provider-side setup is still in progress.';
    case 'live':
      return 'Your payout provider account is ready for provider-backed balance sync and routing.';
    case 'suspended':
      return 'Your payout provider account is suspended. Review the provider status before routing funds.';
    case 'error':
      return 'We could not finish payout setup. Retry the setup action or review the last provider error.';
    default:
      return 'Enable payouts to create a provider-backed partner account.';
  }
}

function serializePartnerProviderAccountView(
  account: partner_provider_account | null,
  options?: {
    availableBalanceMinor?: bigint | null;
    syncWarning?: string | null;
  }
): PartnerProviderAccountView {
  const status = (account?.status as ProviderAccountStatus | null) ?? null;

  return {
    configured: Boolean(account),
    provider: 'xendit',
    providerAccountReference: maskProviderAccountReference(account?.provider_account_id ?? null),
    accountType: (account?.provider_account_type as 'owned' | 'managed' | undefined) ?? null,
    status,
    setupState: mapSetupState(status),
    statusLabel: buildStatusLabel(status),
    statusMessage: buildStatusMessage(status),
    currency: account?.currency ?? null,
    availableBalanceMinor: options?.availableBalanceMinor?.toString() ?? null,
    lastSyncedAt: account?.last_synced_at?.toISOString() ?? null,
    syncWarning: options?.syncWarning ?? null,
  };
}

export async function getPartnerProviderAccountRecord(partnerUserId: bigint) {
  return prisma.partner_provider_account.findFirst({
    where: {
      partner_user_id: partnerUserId,
      provider: 'xendit',
    },
  });
}

async function refreshPartnerAccountRecord(account: partner_provider_account) {
  if (!account.provider_account_id) {
    return {
      account,
      availableBalanceMinor: null,
      syncWarning: null,
    };
  }

  const provider = getFinancialProvider();
  const remote = await provider.getPartnerAccountStatus(account.provider_account_id);
  const updatedAccount = await prisma.partner_provider_account.update({
    where: { id: account.id, },
    data: {
      status: remote.status,
      provider_account_type: remote.accountType,
      currency: remote.currency,
      metadata: mergeMetadata(account.metadata, { last_remote_account: toInputJsonValue(remote.raw), }),
      last_synced_at: new Date(),
      updated_at: new Date(),
    },
  });

  if (remote.status !== 'live') {
    return {
      account: updatedAccount,
      availableBalanceMinor: null,
      syncWarning: null,
    };
  }

  try {
    const balance = await provider.getPartnerBalance(account.provider_account_id);
    await recordPartnerWalletSnapshot({
      partnerUserId: account.partner_user_id,
      partnerProviderAccountId: account.id,
      availableBalanceMinor: balance.availableMinor,
      currency: balance.currency,
      fetchedAt: balance.fetchedAt,
    });

    const accountWithBalanceSync = await prisma.partner_provider_account.findUnique({ where: { id: account.id, }, });

    return {
      account: accountWithBalanceSync ?? updatedAccount,
      availableBalanceMinor: balance.availableMinor,
      syncWarning: null,
    };
  } catch (error) {
    if (!(error instanceof FinancialProviderError)) {
      throw error;
    }

    return {
      account: updatedAccount,
      availableBalanceMinor: null,
      syncWarning: error.message,
    };
  }
}

export async function ensurePartnerProviderAccount(input: {
  partnerUserId: bigint;
  partnerAuthUserId: string;
  email: string | null;
}) {
  if (!input.email) {
    throw new ProviderValidationError(
      'Add an email address to your account before enabling payouts.'
    );
  }

  const existing = await getPartnerProviderAccountRecord(input.partnerUserId);
  if (existing?.provider_account_id) {
    return getPartnerProviderAccountView({
      partnerUserId: input.partnerUserId,
      forceRefresh: true,
    });
  }

  if (existing?.status === 'creating') {
    return serializePartnerProviderAccountView(existing);
  }

  const partnerProfile = await prisma.user.findUnique({
    where: { user_id: input.partnerUserId, },
    select: {
      handle: true,
      first_name: true,
      last_name: true,
    },
  });

  if (!partnerProfile) {
    throw new ProviderValidationError('Unable to load your partner profile.', 404);
  }

  const localAccount = existing
    ? await prisma.partner_provider_account.update({
      where: { id: existing.id, },
      data: {
        status: 'creating',
        metadata: mergeMetadata(existing.metadata, {
          last_setup_requested_at: new Date().toISOString(),
          last_setup_requested_by_auth_user_id: input.partnerAuthUserId,
          last_error_message: null,
        }),
        updated_at: new Date(),
      },
    })
    : await prisma.partner_provider_account.create({
      data: {
        partner_user_id: input.partnerUserId,
        provider: 'xendit',
        provider_account_type: 'owned',
        status: 'creating',
        currency: 'PHP',
        metadata: {
          last_setup_requested_at: new Date().toISOString(),
          last_setup_requested_by_auth_user_id: input.partnerAuthUserId,
        },
      },
    }).catch(async (error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const record = await getPartnerProviderAccountRecord(input.partnerUserId);
        if (record) {
          return record;
        }
      }

      throw error;
    });

  if (!localAccount) {
    throw new ProviderConfigError('Unable to reserve a provider account slot right now.');
  }

  const provider = getFinancialProvider();

  try {
    const createdAccount = await provider.createPartnerAccount({
      partnerUserId: input.partnerUserId,
      partnerAuthUserId: input.partnerAuthUserId,
      email: input.email,
      displayName: buildDisplayName(partnerProfile),
    });

    const updated = await prisma.partner_provider_account.update({
      where: { id: localAccount.id, },
      data: {
        provider_account_id: createdAccount.providerAccountId,
        provider_account_type: createdAccount.accountType,
        status: createdAccount.status,
        currency: createdAccount.currency,
        metadata: mergeMetadata(localAccount.metadata, {
          last_remote_account: toInputJsonValue(createdAccount.raw),
          last_error_message: null,
        }),
        last_synced_at: new Date(),
        updated_at: new Date(),
      },
    });

    return serializePartnerProviderAccountView(updated);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unable to create your payout provider account right now.';

    await prisma.partner_provider_account.update({
      where: { id: localAccount.id, },
      data: {
        status: 'error',
        metadata: mergeMetadata(localAccount.metadata, {
          last_error_message: message,
          last_error_at: new Date().toISOString(),
        }),
        updated_at: new Date(),
      },
    });

    throw error;
  }
}

export async function getPartnerProviderAccountView(input: {
  partnerUserId: bigint;
  forceRefresh?: boolean;
}) {
  const account = await getPartnerProviderAccountRecord(input.partnerUserId);
  if (!account) {
    return serializePartnerProviderAccountView(null);
  }

  const shouldRefresh = Boolean(
    input.forceRefresh ||
      (account.provider_account_id &&
        (!account.last_synced_at ||
          Date.now() - account.last_synced_at.getTime() >= PROVIDER_BALANCE_SYNC_WINDOW_MS))
  );

  if (!shouldRefresh || !account.provider_account_id) {
    return serializePartnerProviderAccountView(account);
  }

  try {
    const refreshed = await refreshPartnerAccountRecord(account);

    return serializePartnerProviderAccountView(refreshed.account, {
      availableBalanceMinor: refreshed.availableBalanceMinor,
      syncWarning: refreshed.syncWarning,
    });
  } catch (error) {
    if (!(error instanceof FinancialProviderError)) {
      throw error;
    }

    return serializePartnerProviderAccountView(account, { syncWarning: error.message, });
  }
}
