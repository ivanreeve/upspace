'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';
import { notificationKeys } from '@/hooks/api/useNotifications';
import type { ComplaintCategory, ComplaintStatus } from '@/lib/complaints/constants';

export type CustomerComplaint = {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  escalation_note: string | null;
  resolution_note: string | null;
  created_at: string;
  space_name: string;
  area_name: string;
  booking_id: string;
};

export type CustomerComplaintsPage = {
  data: CustomerComplaint[];
  nextCursor: string | null;
};

export type SubmitComplaintInput = {
  bookingId: string;
  category: ComplaintCategory;
  description: string;
};

export type SubmitComplaintResponse = {
  complaintId: string;
  status: 'pending';
  message: string;
};

export const customerComplaintKeys = {
  all: ['customer-complaints'] as const,
  list: (limit?: number, cursor?: string | null) =>
    ['customer-complaints', 'list', limit ?? 20, cursor ?? null] as const,
};

export function useSubmitComplaintMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<SubmitComplaintResponse, Error, SubmitComplaintInput>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          booking_id: payload.bookingId,
          category: payload.category,
          description: payload.description,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<SubmitComplaintResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerComplaintKeys.all, });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
    },
  });
}

export function useCustomerComplaintsQuery({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<CustomerComplaintsPage>({
    queryKey: customerComplaintKeys.list(limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ limit: String(limit), });
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/complaints?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: CustomerComplaint[];
        nextCursor: string | null;
      };

      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
      };
    },
    staleTime: 60_000,
  });
}
