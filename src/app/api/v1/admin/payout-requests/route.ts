import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { maskProviderAccountReference } from '@/lib/financial/provider-account-view';
import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { formatUserDisplayName } from '@/lib/user/display-name';
import { adminPayoutRequestsQuerySchema } from '@/lib/validations/admin';

function readProviderSnapshot(
  metadata: Prisma.JsonValue | null
): {
  provider: 'xendit';
  accountReference: string | null;
  accountType: 'owned' | 'managed' | null;
  status: string | null;
  setupState: string | null;
  availableBalanceMinor: string | null;
  lastSyncedAt: string | null;
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const snapshot = (metadata as Prisma.JsonObject).provider_account_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  const providerSnapshot = snapshot as Prisma.JsonObject;

  return {
    provider: 'xendit',
    accountReference:
      typeof providerSnapshot.provider_account_reference === 'string'
        ? providerSnapshot.provider_account_reference
        : null,
    accountType:
      providerSnapshot.account_type === 'owned' || providerSnapshot.account_type === 'managed'
        ? providerSnapshot.account_type
        : null,
    status: typeof providerSnapshot.status === 'string' ? providerSnapshot.status : null,
    setupState: typeof providerSnapshot.setup_state === 'string' ? providerSnapshot.setup_state : null,
    availableBalanceMinor:
      typeof providerSnapshot.available_balance_minor === 'string'
        ? providerSnapshot.available_balance_minor
        : null,
    lastSyncedAt:
      typeof providerSnapshot.last_synced_at === 'string'
        ? providerSnapshot.last_synced_at
        : null,
  };
}

function readPayoutDestination(
  metadata: Prisma.JsonValue | null
): {
  channelCode: string | null;
  channelName: string | null;
  channelCategory: 'BANK' | 'EWALLET' | 'OTC' | null;
  currency: string | null;
  accountHolderName: string | null;
  accountNumberMasked: string | null;
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const destination = (metadata as Prisma.JsonObject).payout_destination;
  if (!destination || typeof destination !== 'object' || Array.isArray(destination)) {
    return null;
  }

  const payoutDestination = destination as Prisma.JsonObject;
  const category = payoutDestination.channelCategory;

  return {
    channelCode:
      typeof payoutDestination.channelCode === 'string'
        ? payoutDestination.channelCode
        : null,
    channelName:
      typeof payoutDestination.channelName === 'string'
        ? payoutDestination.channelName
        : null,
    channelCategory:
      category === 'BANK' || category === 'EWALLET' || category === 'OTC'
        ? category
        : null,
    currency:
      typeof payoutDestination.currency === 'string' ? payoutDestination.currency : null,
    accountHolderName:
      typeof payoutDestination.accountHolderName === 'string'
        ? payoutDestination.accountHolderName
        : null,
    accountNumberMasked:
      typeof payoutDestination.accountNumberMasked === 'string'
        ? payoutDestination.accountNumberMasked
        : null,
  };
}

function readWorkflowStage(
  metadata: Prisma.JsonValue | null
): 'awaiting_review' | 'submitting_to_provider' | 'submitted_to_provider' | 'succeeded' | 'failed' {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'awaiting_review';
  }

  const candidate = (metadata as Prisma.JsonObject).workflow_stage;
  if (
    candidate === 'awaiting_review' ||
    candidate === 'submitting_to_provider' ||
    candidate === 'submitted_to_provider' ||
    candidate === 'succeeded' ||
    candidate === 'failed'
  ) {
    return candidate;
  }

  return 'awaiting_review';
}

function readProviderPayout(
  metadata: Prisma.JsonValue | null
): {
  payoutId: string | null;
  referenceId: string | null;
  providerStatus: string | null;
  channelCode: string | null;
  estimatedArrivalTime: string | null;
  failureCode: string | null;
  submittedAt: string | null;
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const payout = (metadata as Prisma.JsonObject).payout_provider;
  if (!payout || typeof payout !== 'object' || Array.isArray(payout)) {
    return null;
  }

  const providerPayout = payout as Prisma.JsonObject;
  return {
    payoutId: typeof providerPayout.payout_id === 'string' ? providerPayout.payout_id : null,
    referenceId: typeof providerPayout.reference_id === 'string' ? providerPayout.reference_id : null,
    providerStatus: typeof providerPayout.status === 'string' ? providerPayout.status : null,
    channelCode: typeof providerPayout.channel_code === 'string' ? providerPayout.channel_code : null,
    estimatedArrivalTime:
      typeof providerPayout.estimated_arrival_time === 'string'
        ? providerPayout.estimated_arrival_time
        : null,
    failureCode:
      typeof providerPayout.failure_code === 'string'
        ? providerPayout.failure_code
        : null,
    submittedAt:
      typeof providerPayout.submitted_at === 'string'
        ? providerPayout.submitted_at
        : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = adminPayoutRequestsQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payout request query.', },
        { status: 400, }
      );
    }

    const {
      status,
      limit,
      cursor,
    } = parsed.data;
    const orderBy =
      status === 'pending'
        ? [
            { created_at: 'asc' as const, },
            { id: 'asc' as const, }
          ]
        : [
            { created_at: 'desc' as const, },
            { id: 'desc' as const, }
          ];

    const [payoutRequests, totalCount, pendingCount] = await Promise.all([
      prisma.wallet_transaction.findMany({
        where: {
          type: 'payout',
          status,
        },
        take: limit + 1,
        skip: cursor ? 1 : 0,
        ...(cursor ? { cursor: { id: cursor, }, } : {}),
        orderBy,
        include: {
          wallet: {
            select: {
              id: true,
              balance_minor: true,
              user: {
                select: {
                  user_id: true,
                  first_name: true,
                  last_name: true,
                  handle: true,
                  role: true,
                  provider_accounts: {
                    where: { provider: 'xendit', },
                    take: 1,
                    select: {
                      provider: true,
                      provider_account_id: true,
                      provider_account_type: true,
                      status: true,
                      currency: true,
                      last_synced_at: true,
                      metadata: true,
                    },
                  },
                },
              },
            },
          },
          processed_by: {
            select: {
              first_name: true,
              last_name: true,
              handle: true,
            },
          },
        },
      }),
      prisma.wallet_transaction.count({
        where: {
          type: 'payout',
          status,
        },
      }),
      prisma.wallet_transaction.count({
        where: {
          type: 'payout',
          status: 'pending',
        },
      })
    ]);

    const hasNext = payoutRequests.length > limit;
    const items = hasNext ? payoutRequests.slice(0, limit) : payoutRequests;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((request) => {
      const currentProviderAccount = request.wallet.user.provider_accounts[0] ?? null;

      return {
        id: request.id,
        status: request.status,
        amountMinor: request.amount_minor.toString(),
        netAmountMinor: request.net_amount_minor?.toString() ?? null,
        currency: request.currency,
        description: request.description,
        createdAt: request.created_at.toISOString(),
        processedAt: request.processed_at?.toISOString() ?? null,
        resolutionNote: request.resolution_note,
        partner: {
          userId: request.wallet.user.user_id.toString(),
          handle: request.wallet.user.handle,
          role: request.wallet.user.role,
          name: formatUserDisplayName(
            request.wallet.user.first_name,
            request.wallet.user.last_name,
            request.wallet.user.handle
          ),
          currentBalanceMinor: request.wallet.balance_minor.toString(),
        },
        processedBy: request.processed_by
          ? {
              name: formatUserDisplayName(
                request.processed_by.first_name,
                request.processed_by.last_name,
                request.processed_by.handle
              ),
            }
          : null,
        workflowStage: readWorkflowStage(request.metadata),
        payoutDestination: readPayoutDestination(request.metadata),
        providerPayout: readProviderPayout(request.metadata),
        providerSnapshot: readProviderSnapshot(request.metadata),
        partnerProviderAccount: currentProviderAccount
          ? {
              provider: currentProviderAccount.provider,
              accountReference: maskProviderAccountReference(
                currentProviderAccount.provider_account_id
              ),
              accountType: currentProviderAccount.provider_account_type,
              status: currentProviderAccount.status,
              currency: currentProviderAccount.currency,
              lastSyncedAt: currentProviderAccount.last_synced_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({
      data: payload,
      nextCursor,
      totalCount,
      pendingCount,
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to load payout requests', error);
    return NextResponse.json(
      { error: 'Unable to load payout requests.', },
      { status: 500, }
    );
  }
}
