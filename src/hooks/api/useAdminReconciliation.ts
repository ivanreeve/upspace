'use client';

import {
useMutation,
useQuery,
useQueryClient,
type UseQueryOptions
} from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

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

export type AdminReconciliationPayload = {
  rows: AdminReconciliationRow[];
  summary: AdminReconciliationSummary;
};

export type ProviderReconciliationRunSummary = {
  checkedAccounts: number;
  syncedAccounts: number;
  failedAccounts: number;
  reconciledPayouts: number;
  staleAccountsBeforeRun: number;
};

export const adminReconciliationKeys = {
  all: ['admin-reconciliation'] as const,
  detail: (limit: number) => ['admin-reconciliation', 'detail', limit] as const,
};

type AdminReconciliationQueryOptions = Omit<
  UseQueryOptions<AdminReconciliationPayload>,
  'queryKey' | 'queryFn'
>;

export function useAdminReconciliationQuery({
  limit = 50,
  ...options
}: { limit?: number } & AdminReconciliationQueryOptions = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AdminReconciliationPayload>({
    queryKey: adminReconciliationKeys.detail(limit),
    staleTime: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), });
      const response = await authFetch(`/api/v1/admin/reconciliation?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, 'Unable to load reconciliation data.'));
      }

      const payload = await response.json();
      return payload.data as AdminReconciliationPayload;
    },
    ...options,
  });
}

export function useRunAdminReconciliationMutation(limit = 50) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<ProviderReconciliationRunSummary, Error, void>({
    mutationFn: async () => {
      const response = await authFetch('/api/v1/admin/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ limit, }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, 'Unable to run reconciliation.'));
      }

      const payload = await response.json();
      return payload.data as ProviderReconciliationRunSummary;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminReconciliationKeys.all, });
    },
  });
}
