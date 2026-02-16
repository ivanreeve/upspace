'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

export type WalletTransactionType = 'cash_in' | 'charge' | 'refund' | 'payout';
export type WalletTransactionStatus = 'pending' | 'succeeded' | 'failed';

export type WalletTransactionRecord = {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amountMinor: string;
  netAmountMinor: string | null;
  currency: string;
  description: string | null;
  bookingId: string | null;
  externalReference: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type WalletSnapshot = {
  id: string;
  balanceMinor: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type WalletPagination = {
  hasMore: boolean;
  nextCursor: string | undefined;
};

export type WalletStats = {
  totalEarnedMinor: string;
  totalRefundedMinor: string;
  transactionCount: number;
};

export type WalletData = {
  wallet: WalletSnapshot;
  transactions: WalletTransactionRecord[];
  pagination: WalletPagination;
  stats: WalletStats;
};

export type WalletFilters = {
  type?: WalletTransactionType;
  status?: WalletTransactionStatus;
};

export const walletQueryKey = ['wallet'];

export function useWallet(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useQuery<WalletData>({
    queryKey: walletQueryKey,
    queryFn: async () => {
      const response = await fetch('/api/v1/wallet?limit=1', {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message ?? 'Unable to load wallet information.'
        );
      }

      return payload as WalletData;
    },
    enabled,
    retry: 1,
    staleTime: 1000 * 30,
  });
}

export function useWalletTransactions(options?: {
  enabled?: boolean;
  filters?: WalletFilters;
  limit?: number;
}) {
  const enabled = options?.enabled ?? true;
  const filters = options?.filters;
  const limit = options?.limit ?? 25;

  return useInfiniteQuery<WalletData>({
    queryKey: ['wallet-transactions', filters, limit],
    queryFn: async ({ pageParam, }) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (pageParam) params.set('cursor', pageParam as string);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.status) params.set('status', filters.status);

      const response = await fetch(`/api/v1/wallet?${params.toString()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message ?? 'Unable to load wallet information.'
        );
      }

      return payload as WalletData;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    enabled,
    retry: 1,
    staleTime: 1000 * 30,
  });
}
