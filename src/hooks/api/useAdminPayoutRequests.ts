'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/components/auth/SessionProvider';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { adminReportsKeys } from '@/hooks/api/useAdminReports';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

export type AdminPayoutRequest = {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountMinor: string;
  netAmountMinor: string | null;
  currency: string;
  description: string | null;
  createdAt: string;
  processedAt: string | null;
  resolutionNote: string | null;
  partner: {
    userId: string;
    handle: string;
    role: 'customer' | 'partner' | 'admin';
    name: string;
    currentBalanceMinor: string;
  };
  processedBy: {
    name: string;
  } | null;
};

export type AdminPayoutRequestsPage = {
  data: AdminPayoutRequest[];
  nextCursor: string | null;
  totalCount: number;
  pendingCount: number;
};

export const adminPayoutRequestKeys = {
  all: ['admin-payout-requests'] as const,
  list: (
    status?: AdminPayoutRequest['status'],
    limit?: number,
    cursor?: string | null
  ) =>
    ['admin-payout-requests', 'list', status ?? 'pending', limit ?? 20, cursor ?? null] as const,
};

export function useAdminPayoutRequestsQuery({
  status = 'pending',
  limit = 20,
  cursor,
}: {
  status?: AdminPayoutRequest['status'];
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();
  const {
    session,
    isLoading,
  } = useSession();
  const isSessionReady = Boolean(session && !isLoading);
  const REFRESH_INTERVAL_MS = 15_000;

  return useQuery<AdminPayoutRequestsPage>({
    enabled: isSessionReady,
    queryKey: adminPayoutRequestKeys.list(status, limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status,
        limit: String(limit),
      });
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(
        `/api/v1/admin/payout-requests?${searchParams.toString()}`
      );
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: AdminPayoutRequest[];
        nextCursor: string | null;
        totalCount: number;
        pendingCount: number;
      };

      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
        totalCount: payload.totalCount ?? 0,
        pendingCount: payload.pendingCount ?? 0,
      };
    },
    staleTime: 60_000,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useCompleteAdminPayoutRequestMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      resolutionNote,
    }: {
      requestId: string;
      resolutionNote?: string;
    }) => {
      const response = await authFetch(`/api/v1/admin/payout-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'complete',
          resolution_note: resolutionNote,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ status: 'succeeded' }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPayoutRequestKeys.all, });
      queryClient.invalidateQueries({ queryKey: adminReportsKeys.all, });
    },
  });
}

export function useRejectAdminPayoutRequestMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      resolutionNote,
    }: {
      requestId: string;
      resolutionNote: string;
    }) => {
      const response = await authFetch(`/api/v1/admin/payout-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'reject',
          resolution_note: resolutionNote,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ status: 'failed' }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPayoutRequestKeys.all, });
      queryClient.invalidateQueries({ queryKey: adminReportsKeys.all, });
    },
  });
}
