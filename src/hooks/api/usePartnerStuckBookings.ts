'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type StuckBookingsSummary = {
  pendingPaid: number;
};

export function usePartnerStuckBookingsQuery() {
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
    staleTime: 30_000,
  });
}
