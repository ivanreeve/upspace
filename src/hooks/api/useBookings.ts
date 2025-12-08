'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions
} from '@tanstack/react-query';

import type { BookingRecord, BookingStatus } from '@/lib/bookings/types';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

const bookingKeys = {
  base: ['bookings'] as const,
  user: () => ['bookings', 'user'] as const,
  partner: () => ['bookings', 'partner'] as const,
};

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
  return 'Something went wrong. Please try again.';
};

const mergeUpdatedBookings = (
  existing: BookingRecord[] | undefined,
  updates: BookingRecord[]
) => {
  if (!existing) {
    return existing;
  }

  const updateLookup = new Map(updates.map((booking) => [booking.id, booking]));
  return existing.map((booking) => updateLookup.get(booking.id) ?? booking);
};

async function fetchBookings(authFetch: ReturnType<typeof useAuthenticatedFetch>): Promise<BookingRecord[]> {
  const response = await authFetch('/api/v1/bookings');
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = await response.json();
  return (payload?.data ?? []) as BookingRecord[];
}

export function useUserBookingsQuery(
  options?: Omit<UseQueryOptions<BookingRecord[], Error>, 'queryKey' | 'queryFn'>
) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<BookingRecord[]>({
    queryKey: bookingKeys.user(),
    queryFn: () => fetchBookings(authFetch),
    ...options,
  });
}

export function usePartnerBookingsQuery(
  options?: Omit<UseQueryOptions<BookingRecord[], Error>, 'queryKey' | 'queryFn'>
) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<BookingRecord[]>({
    queryKey: bookingKeys.partner(),
    queryFn: () => fetchBookings(authFetch),
    ...options,
  });
}

type CreateBookingInput = {
  spaceId: string;
  areaId: string;
  bookingHours: number;
  price?: number | null;
};

type BulkUpdateBookingStatusInput = {
  ids: string[];
  status: BookingStatus;
};

export function useCreateBookingMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<BookingRecord, Error, CreateBookingInput>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          spaceId: payload.spaceId,
          areaId: payload.areaId,
          bookingHours: payload.bookingHours,
          price: payload.price ?? null,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = await response.json();
      return data.data as BookingRecord;
    },
    onSuccess: (booking) => {
      queryClient.setQueryData<BookingRecord[]>(bookingKeys.user(), (previous) => {
        if (!previous) {
          return [booking];
        }
        if (previous.some((existing) => existing.id === booking.id)) {
          return previous;
        }
        return [booking, ...previous];
      });
      queryClient.invalidateQueries({ queryKey: bookingKeys.partner(), });
      queryClient.invalidateQueries({ queryKey: ['notifications'], });
    },
  });
}

type CreateCheckoutSessionInput = {
  spaceId: string;
  areaId: string;
  bookingHours: number;
  price: number;
};

type CreateCheckoutSessionResponse = {
  bookingId: string;
  checkoutUrl: string;
};

export function useCreateCheckoutSessionMutation() {
  const authFetch = useAuthenticatedFetch();

  return useMutation<CreateCheckoutSessionResponse, Error, CreateCheckoutSessionInput>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/paymongo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          spaceId: payload.spaceId,
          areaId: payload.areaId,
          bookingHours: payload.bookingHours,
          price: payload.price,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return payload as CreateCheckoutSessionResponse;
    },
  });
}

export function useBulkUpdateBookingStatusMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<BookingRecord[], Error, BulkUpdateBookingStatusInput>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = await response.json();
      return (data?.data ?? []) as BookingRecord[];
    },
    onSuccess: (updatedBookings) => {
      queryClient.setQueryData<BookingRecord[]>(
        bookingKeys.partner(),
        (existing) => mergeUpdatedBookings(existing, updatedBookings)
      );
      queryClient.setQueryData<BookingRecord[]>(
        bookingKeys.user(),
        (existing) => mergeUpdatedBookings(existing, updatedBookings)
      );
    },
  });
}
