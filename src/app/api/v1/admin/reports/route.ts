import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { adminReportQuerySchema } from '@/lib/validations/admin';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PROVIDER_RECONCILIATION_STALE_MS = 15 * 60 * 1000;
const CANCELLATION_STATUSES = new Set(['cancelled', 'noshow']);

type ResolutionItem = {
  createdAt: Date;
  processedAt: Date | null;
};

const toBigInt = (value: bigint | number | null | undefined) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return BigInt(0);
};

const toNumber = (value: bigint | number | null | undefined) =>
  typeof value === 'bigint' ? Number(value) : Number(value ?? 0);

const calculatePercentChange = (current: number, previous: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
};

const calculateOldestPendingDays = (date: Date | null, now: Date) => {
  if (!date) return null;
  const diff = Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY);
  return Math.max(diff, 0);
};

const calculateAverageResolutionDays = (items: ResolutionItem[]) => {
  const durations = items
    .map((item) => {
      if (!item.processedAt) return null;
      const diff = (item.processedAt.getTime() - item.createdAt.getTime()) / MS_PER_DAY;
      return diff >= 0 ? diff : null;
    })
    .filter((value): value is number => value !== null);

  if (!durations.length) {
    return null;
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round((total / durations.length) * 10) / 10;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const parsed = adminReportQuerySchema.safeParse({ days: req.nextUrl.searchParams.get('days') ?? undefined, });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid report query.', },
        { status: 400, }
      );
    }

    const days = parsed.data.days ?? 30;
    const rangeEnd = new Date();
    const rangeStart = subDays(rangeEnd, days);
    const previousStart = subDays(rangeStart, days);

    const currentRange = {
 gte: rangeStart,
lt: rangeEnd, 
};
    const previousRange = {
 gte: previousStart,
lt: rangeStart, 
};
    const providerStaleCutoff = new Date(rangeEnd.getTime() - PROVIDER_RECONCILIATION_STALE_MS);

    const bookingStatusCurrentPromise = prisma.booking.groupBy({
      by: ['status'],
      where: { created_at: currentRange, },
      _count: { _all: true, },
    });
    const bookingStatusPreviousPromise = prisma.booking.groupBy({
      by: ['status'],
      where: { created_at: previousRange, },
      _count: { _all: true, },
    });
    const bookingStatusBySpacePromise = prisma.booking.groupBy({
      by: ['space_id', 'status'],
      where: { created_at: currentRange, },
      _count: { _all: true, },
    });

    const grossCurrentPromise = prisma.payment_transaction.aggregate({
      where: {
        status: 'succeeded',
        created_at: currentRange,
      },
      _sum: { amount_minor: true, },
      _count: { _all: true, },
    });
    const grossPreviousPromise = prisma.payment_transaction.aggregate({
      where: {
        status: 'succeeded',
        created_at: previousRange,
      },
      _sum: { amount_minor: true, },
      _count: { _all: true, },
    });
    const refundsCurrentPromise = prisma.wallet_transaction.aggregate({
      where: {
 type: 'refund',
status: 'succeeded',
created_at: currentRange, 
},
      _sum: { amount_minor: true, },
      _count: { _all: true, },
    });
    const refundsPreviousPromise = prisma.wallet_transaction.aggregate({
      where: {
 type: 'refund',
status: 'succeeded',
created_at: previousRange, 
},
      _sum: { amount_minor: true, },
      _count: { _all: true, },
    });

    const reviewsCurrentPromise = prisma.review.aggregate({
      where: { created_at: currentRange, },
      _avg: { rating_star: true, },
    });
    const reviewsPreviousPromise = prisma.review.aggregate({
      where: { created_at: previousRange, },
      _avg: { rating_star: true, },
    });

    const verificationPendingCountPromise = prisma.verification.count({ where: { status: 'in_review', }, });
    const verificationOldestPromise = prisma.verification.findFirst({
      where: { status: 'in_review', },
      orderBy: { submitted_at: 'asc', },
      select: { submitted_at: true, },
    });
    const verificationResolvedPromise = prisma.verification.findMany({
      where: {
        status: { in: ['approved', 'rejected'], },
        OR: [
          { approved_at: currentRange, },
          { rejected_at: currentRange, }
        ],
      },
      select: {
        submitted_at: true,
        approved_at: true,
        rejected_at: true,
      },
    });

    const unpublishPendingCountPromise = prisma.unpublish_request.count({ where: { status: 'pending', }, });
    const unpublishOldestPromise = prisma.unpublish_request.findFirst({
      where: { status: 'pending', },
      orderBy: { created_at: 'asc', },
      select: { created_at: true, },
    });
    const unpublishResolvedPromise = prisma.unpublish_request.findMany({
      where: {
        status: { in: ['approved', 'rejected'], },
        processed_at: currentRange,
      },
      select: {
        created_at: true,
        processed_at: true,
      },
    });

    const deactivationPendingCountPromise = prisma.deactivation_request.count({ where: { status: 'pending', }, });
    const deactivationOldestPromise = prisma.deactivation_request.findFirst({
      where: { status: 'pending', },
      orderBy: { created_at: 'asc', },
      select: { created_at: true, },
    });
    const deactivationResolvedPromise = prisma.deactivation_request.findMany({
      where: {
        status: { in: ['approved', 'rejected'], },
        processed_at: currentRange,
      },
      select: {
        created_at: true,
        processed_at: true,
      },
    });

    const chatPendingCountPromise = prisma.chat_report.count({ where: { status: 'pending', }, });
    const chatOldestPromise = prisma.chat_report.findFirst({
      where: { status: 'pending', },
      orderBy: { created_at: 'asc', },
      select: { created_at: true, },
    });
    const chatResolvedPromise = prisma.chat_report.findMany({
      where: {
        status: { in: ['resolved', 'dismissed'], },
        processed_at: currentRange,
      },
      select: {
        created_at: true,
        processed_at: true,
      },
    });
    const payoutPendingCountPromise = prisma.wallet_transaction.count({
      where: {
        type: 'payout',
        status: 'pending',
      },
    });
    const payoutOldestPromise = prisma.wallet_transaction.findFirst({
      where: {
        type: 'payout',
        status: 'pending',
      },
      orderBy: { created_at: 'asc', },
      select: { created_at: true, },
    });
    const payoutResolvedPromise = prisma.wallet_transaction.findMany({
      where: {
        type: 'payout',
        status: { in: ['succeeded', 'failed'], },
        processed_at: currentRange,
      },
      select: {
        created_at: true,
        processed_at: true,
      },
    });
    const providerConfiguredCountPromise = prisma.partner_provider_account.count({
      where: {
        provider: 'xendit',
        provider_account_id: { not: null, },
      },
    });
    const providerLiveCountPromise = prisma.partner_provider_account.count({
      where: {
        provider: 'xendit',
        status: 'live',
        provider_account_id: { not: null, },
      },
    });
    const providerStaleCountPromise = prisma.partner_provider_account.count({
      where: {
        provider: 'xendit',
        provider_account_id: { not: null, },
        OR: [
          { last_synced_at: null, },
          { last_synced_at: { lt: providerStaleCutoff, }, }
        ],
      },
    });
    const failedWalletSnapshotsPromise = prisma.partner_wallet_snapshot.count({
      where: {
        sync_status: 'failed',
        fetched_at: currentRange,
      },
    });
    const pendingProviderPayoutsPromise = prisma.wallet_transaction.count({
      where: {
        type: 'payout',
        status: 'pending',
        metadata: {
          path: ['workflow_stage'],
          equals: 'submitted_to_provider',
        },
      },
    });
    const pendingRefundsPromise = prisma.wallet_transaction.count({
      where: {
        type: 'refund',
        status: 'pending',
      },
    });

    const [
      bookingStatusCurrent,
      bookingStatusPrevious,
      bookingStatusBySpace,
      grossCurrent,
      grossPrevious,
      refundsCurrent,
      refundsPrevious,
      reviewsCurrent,
      reviewsPrevious,
      verificationPendingCount,
      verificationOldest,
      verificationResolved,
      unpublishPendingCount,
      unpublishOldest,
      unpublishResolved,
      deactivationPendingCount,
      deactivationOldest,
      deactivationResolved,
      chatPendingCount,
      chatOldest,
      chatResolved,
      payoutPendingCount,
      payoutOldest,
      payoutResolved,
      providerConfiguredCount,
      providerLiveCount,
      providerStaleCount,
      failedWalletSnapshots,
      pendingProviderPayouts,
      pendingRefunds
    ] = await Promise.all([
      bookingStatusCurrentPromise,
      bookingStatusPreviousPromise,
      bookingStatusBySpacePromise,
      grossCurrentPromise,
      grossPreviousPromise,
      refundsCurrentPromise,
      refundsPreviousPromise,
      reviewsCurrentPromise,
      reviewsPreviousPromise,
      verificationPendingCountPromise,
      verificationOldestPromise,
      verificationResolvedPromise,
      unpublishPendingCountPromise,
      unpublishOldestPromise,
      unpublishResolvedPromise,
      deactivationPendingCountPromise,
      deactivationOldestPromise,
      deactivationResolvedPromise,
      chatPendingCountPromise,
      chatOldestPromise,
      chatResolvedPromise,
      payoutPendingCountPromise,
      payoutOldestPromise,
      payoutResolvedPromise,
      providerConfiguredCountPromise,
      providerLiveCountPromise,
      providerStaleCountPromise,
      failedWalletSnapshotsPromise,
      pendingProviderPayoutsPromise,
      pendingRefundsPromise
    ]);

    const bookingTotalCurrent = bookingStatusCurrent.reduce(
      (sum, entry) => sum + entry._count._all,
      0
    );
    const bookingTotalPrevious = bookingStatusPrevious.reduce(
      (sum, entry) => sum + entry._count._all,
      0
    );
    const cancelledCurrent = bookingStatusCurrent.reduce((sum, entry) => (
      CANCELLATION_STATUSES.has(entry.status) ? sum + entry._count._all : sum
    ), 0);
    const cancelledPrevious = bookingStatusPrevious.reduce((sum, entry) => (
      CANCELLATION_STATUSES.has(entry.status) ? sum + entry._count._all : sum
    ), 0);

    const cancellationRateCurrent =
      bookingTotalCurrent > 0 ? cancelledCurrent / bookingTotalCurrent : 0;
    const cancellationRatePrevious =
      bookingTotalPrevious > 0 ? cancelledPrevious / bookingTotalPrevious : 0;

    const grossCurrentMinor = toBigInt(grossCurrent._sum.amount_minor);
    const grossPreviousMinor = toBigInt(grossPrevious._sum.amount_minor);
    const refundedCurrentMinor = toBigInt(refundsCurrent._sum.amount_minor);
    const refundedPreviousMinor = toBigInt(refundsPrevious._sum.amount_minor);

    const grossChangePct = calculatePercentChange(
      toNumber(grossCurrentMinor),
      toNumber(grossPreviousMinor)
    );
    const refundAmountChangePct = calculatePercentChange(
      toNumber(refundedCurrentMinor),
      toNumber(refundedPreviousMinor)
    );

    const grossCountCurrent = grossCurrent._count._all;
    const grossCountPrevious = grossPrevious._count._all;
    const refundedCountCurrent = refundsCurrent._count._all;
    const refundedCountPrevious = refundsPrevious._count._all;
    const refundRateCurrent =
      grossCountCurrent > 0 ? refundedCountCurrent / grossCountCurrent : 0;
    const refundRatePrevious =
      grossCountPrevious > 0 ? refundedCountPrevious / grossCountPrevious : 0;

    const reviewAverageCurrent = reviewsCurrent._avg.rating_star;
    const reviewAveragePrevious = reviewsPrevious._avg.rating_star;
    const reviewAverageCurrentValue =
      reviewAverageCurrent === null ? null : Number(reviewAverageCurrent);
    const reviewAveragePreviousValue =
      reviewAveragePrevious === null ? null : Number(reviewAveragePrevious);

    const ratingChangePct =
      reviewAverageCurrentValue !== null && reviewAveragePreviousValue !== null
        ? calculatePercentChange(reviewAverageCurrentValue, reviewAveragePreviousValue)
        : null;

    const bookingChangePct = calculatePercentChange(
      bookingTotalCurrent,
      bookingTotalPrevious
    );
    const cancellationChangePct = calculatePercentChange(
      cancellationRateCurrent,
      cancellationRatePrevious
    );
    const refundRateChangePct = calculatePercentChange(
      refundRateCurrent,
      refundRatePrevious
    );

    const queueHealth = [
      {
        key: 'verifications',
        label: 'Verifications',
        pendingCount: verificationPendingCount,
        oldestPendingDays: calculateOldestPendingDays(
          verificationOldest?.submitted_at ?? null,
          rangeEnd
        ),
        averageResolutionDays: calculateAverageResolutionDays(
          verificationResolved.map((item) => ({
            createdAt: item.submitted_at,
            processedAt: item.approved_at ?? item.rejected_at,
          }))
        ),
        resolvedCount: verificationResolved.length,
      },
      {
        key: 'unpublish_requests',
        label: 'Unpublish requests',
        pendingCount: unpublishPendingCount,
        oldestPendingDays: calculateOldestPendingDays(
          unpublishOldest?.created_at ?? null,
          rangeEnd
        ),
        averageResolutionDays: calculateAverageResolutionDays(
          unpublishResolved.map((item) => ({
            createdAt: item.created_at,
            processedAt: item.processed_at,
          }))
        ),
        resolvedCount: unpublishResolved.length,
      },
      {
        key: 'deactivation_requests',
        label: 'Deactivation requests',
        pendingCount: deactivationPendingCount,
        oldestPendingDays: calculateOldestPendingDays(
          deactivationOldest?.created_at ?? null,
          rangeEnd
        ),
        averageResolutionDays: calculateAverageResolutionDays(
          deactivationResolved.map((item) => ({
            createdAt: item.created_at,
            processedAt: item.processed_at,
          }))
        ),
        resolvedCount: deactivationResolved.length,
      },
      {
        key: 'chat_reports',
        label: 'Chat reports',
        pendingCount: chatPendingCount,
        oldestPendingDays: calculateOldestPendingDays(
          chatOldest?.created_at ?? null,
          rangeEnd
        ),
        averageResolutionDays: calculateAverageResolutionDays(
          chatResolved.map((item) => ({
            createdAt: item.created_at,
            processedAt: item.processed_at,
          }))
        ),
        resolvedCount: chatResolved.length,
      },
      {
        key: 'payout_requests',
        label: 'Payout requests',
        pendingCount: payoutPendingCount,
        oldestPendingDays: calculateOldestPendingDays(
          payoutOldest?.created_at ?? null,
          rangeEnd
        ),
        averageResolutionDays: calculateAverageResolutionDays(
          payoutResolved.map((item) => ({
            createdAt: item.created_at,
            processedAt: item.processed_at,
          }))
        ),
        resolvedCount: payoutResolved.length,
      }
    ];

    const spaceStats = new Map<string, { total: number; cancelled: number; }>();
    bookingStatusBySpace.forEach((entry) => {
      const current = spaceStats.get(entry.space_id) ?? {
 total: 0,
cancelled: 0, 
};
      current.total += entry._count._all;
      if (CANCELLATION_STATUSES.has(entry.status)) {
        current.cancelled += entry._count._all;
      }
      spaceStats.set(entry.space_id, current);
    });

    const topCancellationCandidates = Array.from(spaceStats.entries())
      .map(([spaceId, stats]) => ({
        spaceId,
        total: stats.total,
        cancelled: stats.cancelled,
        rate: stats.total > 0 ? stats.cancelled / stats.total : 0,
      }))
      .filter((entry) => entry.total >= 5 && entry.cancelled > 0)
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return b.total - a.total;
      })
      .slice(0, 5);

    const topSpaceIds = topCancellationCandidates.map((entry) => entry.spaceId);
    const topSpaces = topSpaceIds.length
      ? await prisma.space.findMany({
        where: { id: { in: topSpaceIds, }, },
        select: {
 id: true,
name: true,
city: true,
region: true, 
},
      })
      : [];

    const topSpaceLookup = new Map(
      topSpaces.map((space) => [space.id, space])
    );

    const payload = {
      range: {
        days,
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: rangeStart.toISOString(),
      },
      trends: {
        bookings: {
          current: bookingTotalCurrent,
          previous: bookingTotalPrevious,
          changePct: bookingChangePct,
        },
        grossRevenue: {
          currentMinor: grossCurrentMinor.toString(),
          previousMinor: grossPreviousMinor.toString(),
          changePct: grossChangePct,
        },
        cancellationRate: {
          current: cancellationRateCurrent,
          previous: cancellationRatePrevious,
          changePct: cancellationChangePct,
        },
        refunds: {
          rate: {
            current: refundRateCurrent,
            previous: refundRatePrevious,
            changePct: refundRateChangePct,
          },
          count: {
            current: refundedCountCurrent,
            previous: refundedCountPrevious,
            changePct: calculatePercentChange(refundedCountCurrent, refundedCountPrevious),
          },
          amountMinor: {
            currentMinor: refundedCurrentMinor.toString(),
            previousMinor: refundedPreviousMinor.toString(),
            changePct: refundAmountChangePct,
          },
        },
        averageRating: {
          current: reviewAverageCurrentValue,
          previous: reviewAveragePreviousValue,
          changePct: ratingChangePct,
        },
      },
      queueHealth,
      providerHealth: {
        configuredAccounts: providerConfiguredCount,
        liveAccounts: providerLiveCount,
        staleAccounts: providerStaleCount,
        failedSnapshotCount: failedWalletSnapshots,
        pendingProviderPayouts,
        pendingRefunds,
      },
      risk: {
        topCancellationSpaces: topCancellationCandidates.map((entry) => {
          const space = topSpaceLookup.get(entry.spaceId);
          return {
            space_id: entry.spaceId,
            space_name: space?.name ?? 'Unknown space',
            city: space?.city ?? 'Unknown city',
            region: space?.region ?? 'Unknown region',
            totalBookings: entry.total,
            cancelledBookings: entry.cancelled,
            cancellationRate: entry.rate,
          };
        }),
      },
    };

    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to load admin reports', error);
    return NextResponse.json(
      { error: 'Unable to load admin reports.', },
      { status: 500, }
    );
  }
}
