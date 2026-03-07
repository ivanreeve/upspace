'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type StuckBookingsSummary = {
  pendingPaid: number;
};

export function usePartnerStuckBookingsQuery(
  options?: Omit<UseQueryOptions<StuckBookingsSummary, Error>, 'queryKey' | 'queryFn'>
) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<StuckBookingsSummary>({
    queryKey: ['partner', 'bookings', 'stuck'],
    queryFn: async () => {
      const response = await authFetch('/api/v1/partner/stuck-bookings');
      if (!response.ok) {
        throw new Error('Unable to load stuck bookings.');
      }
      const body = await response.json();
      return body.data as StuckBookingsSummary;
    },
    staleTime: 60_000,
    ...options,
  });
}
