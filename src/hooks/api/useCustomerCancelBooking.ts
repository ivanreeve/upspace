'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { bookingKeys } from './useBookings';
import { notificationKeys } from './useNotifications';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export function useCustomerCancelBookingMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { bookingId: string }>({
    mutationFn: async ({ bookingId, }) => {
      const response = await authFetch(`/api/v1/bookings/${bookingId}/cancel`, { method: 'POST', });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to cancel booking.');
      }

      const payload = await response.json();
      return payload.data;
    },
    onSuccess: () => {
      toast.success('Booking cancelled.');
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
