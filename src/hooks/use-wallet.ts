'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export type WalletData = {
  wallet: WalletSnapshot;
  transactions: WalletTransactionRecord[];
};

export const walletQueryKey = ['wallet'];

export function useWallet(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useQuery<WalletData>({
    queryKey: walletQueryKey,
    queryFn: async () => {
      const response = await fetch('/api/v1/wallet', {
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

export function useWalletTopUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, }: { amount: number }) => {
      const response = await fetch('/api/v1/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        credentials: 'same-origin',
        body: JSON.stringify({ amount, }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to top up your wallet.');
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletQueryKey, });
    },
  });
}
