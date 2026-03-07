'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

export type AdminReportTrendMetric = {
  current: number;
  previous: number;
  changePct: number | null;
};

export type AdminReportAmountTrend = {
  currentMinor: string;
  previousMinor: string;
  changePct: number | null;
};

export type AdminReportRateTrend = {
  current: number;
  previous: number;
  changePct: number | null;
};

export type AdminReportRatingTrend = {
  current: number | null;
  previous: number | null;
  changePct: number | null;
};

export type AdminReportRefundTrends = {
  rate: AdminReportRateTrend;
  count: AdminReportTrendMetric;
  amountMinor: AdminReportAmountTrend;
};

export type AdminReportQueueHealth = {
  key:
    | 'verifications'
    | 'unpublish_requests'
    | 'deactivation_requests'
    | 'chat_reports'
    | 'payout_requests';
  label: string;
  pendingCount: number;
  oldestPendingDays: number | null;
  averageResolutionDays: number | null;
  resolvedCount: number;
};

export type AdminReportRiskSpace = {
  space_id: string;
  space_name: string;
  city: string;
  region: string;
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
};

export type AdminReportPayload = {
  range: {
    days: number;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  trends: {
    bookings: AdminReportTrendMetric;
    grossRevenue: AdminReportAmountTrend;
    cancellationRate: AdminReportRateTrend;
    refunds: AdminReportRefundTrends;
    averageRating: AdminReportRatingTrend;
  };
  queueHealth: AdminReportQueueHealth[];
  risk: {
    topCancellationSpaces: AdminReportRiskSpace[];
  };
};

export const adminReportsKeys = {
  all: ['admin-reports'] as const,
  detail: (days: number) => ['admin-reports', 'detail', days] as const,
};

type AdminReportsQueryOptions = Omit<
  UseQueryOptions<AdminReportPayload>,
  'queryKey' | 'queryFn'
>;

export function useAdminReportsQuery({
  days = 30,
  ...options
}: { days?: number } & AdminReportsQueryOptions = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AdminReportPayload>({
    queryKey: adminReportsKeys.detail(days),
    staleTime: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days), });
      const response = await authFetch(`/api/v1/admin/reports?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, 'Unable to load admin report.'));
      }
      const payload = await response.json();
      return payload.data;
    },
    ...options,
  });
}
