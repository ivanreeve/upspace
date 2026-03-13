'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

export type PayoutChannel = {
  channelCode: string;
  channelName: string;
  category: 'BANK' | 'EWALLET';
  currency: string;
  country: string | null;
  minimumAmountMinor: string | null;
  maximumAmountMinor: string | null;
};

export function usePayoutChannelsQuery(options?: { enabled?: boolean }) {
  const authFetch = useAuthenticatedFetch();
  const enabled = options?.enabled ?? true;

  return useQuery<PayoutChannel[]>({
    queryKey: ['payout-channels'],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const response = await authFetch('/api/v1/financial/payout-channels');
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as { data?: PayoutChannel[] };
      return payload.data ?? [];
    },
  });
}
