'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { CustomerTransactionRecord } from '@/types/transactions';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

type CustomerTransactionsPage = {
  data: CustomerTransactionRecord[];
  pagination: { hasMore: boolean; nextCursor: string | undefined };
};

export const customerTransactionKeys = {
  all: ['customer-transactions'] as const,
  list: (limit?: number) => ['customer-transactions', 'list', limit] as const,
};

export function useCustomerTransactionsQuery(options?: {
  enabled?: boolean;
  limit?: number;
}) {
  const authFetch = useAuthenticatedFetch();
  const enabled = options?.enabled ?? true;
  const limit = options?.limit ?? 25;

  return useInfiniteQuery<CustomerTransactionsPage>({
    queryKey: customerTransactionKeys.list(limit),
    queryFn: async ({ pageParam, }) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (pageParam) params.set('cursor', pageParam as string);

      const response = await authFetch(`/api/v1/customer/transactions?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Unable to load transactions.');
      }
      return await response.json() as CustomerTransactionsPage;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    enabled,
    retry: 1,
    staleTime: 1000 * 30,
  });
}
