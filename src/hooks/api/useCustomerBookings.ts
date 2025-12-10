'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { BookingRecord } from '@/lib/bookings/types';

export const customerBookingsKeys = {
  all: ['customer-bookings'] as const,
};

type CustomerBookingsQueryOptions = Omit<
  UseQueryOptions<BookingRecord[]>,
  'queryKey' | 'queryFn'
>;

const parseErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') {
      return body.error;
    }
    if (typeof body?.message === 'string') {
      return body.message;
    }
  } catch {
    // ignore
  }
  return 'Unable to load bookings.';
};

export function useCustomerBookingsQuery(options?: CustomerBookingsQueryOptions) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<BookingRecord[]>({
    queryKey: customerBookingsKeys.all,
    queryFn: async () => {
      const response = await authFetch('/api/v1/bookings');
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const payload = await response.json();
      return payload.data;
    },
    ...options,
  });
}
