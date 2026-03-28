'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { bookingKeys } from './useBookings';
import { notificationKeys } from './useNotifications';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { BookingRecord } from '@/lib/bookings/types';

type CancelBookingResponse = {
  data: BookingRecord;
  message?: string;
};

export function useCustomerCancelBookingMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<CancelBookingResponse, Error, { bookingId: string }>({
    mutationFn: async ({ bookingId, }) => {
      const response = await authFetch(`/api/v1/bookings/${bookingId}/cancel`, { method: 'POST', });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to cancel booking.';
        throw new Error(message);
      }

      return payload as CancelBookingResponse;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? 'Booking cancelled.');
      queryClient.invalidateQueries({ queryKey: bookingKeys.user(), });
      queryClient.invalidateQueries({ queryKey: bookingKeys.partner(), });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
      queryClient.invalidateQueries({ queryKey: ['partner', 'bookings', 'stuck'], });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
