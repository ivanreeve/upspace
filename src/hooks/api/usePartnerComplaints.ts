'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';
import { notificationKeys } from '@/hooks/api/useNotifications';
import type { ComplaintCategory, ComplaintStatus } from '@/lib/complaints/constants';

export type PartnerComplaint = {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  escalation_note: string | null;
  resolution_note: string | null;
  created_at: string;
  processed_at: string | null;
  space_name: string;
  area_name: string;
  booking_id: string;
  customer: {
    handle: string;
    name: string;
  };
};

export type PartnerComplaintsPage = {
  data: PartnerComplaint[];
  nextCursor: string | null;
};

export const partnerComplaintKeys = {
  all: ['partner-complaints'] as const,
  list: (status?: ComplaintStatus, limit?: number, cursor?: string | null) =>
    ['partner-complaints', 'list', status ?? 'pending', limit ?? 20, cursor ?? null] as const,
};

export function usePartnerComplaintsQuery({
  status = 'pending',
  limit = 20,
  cursor,
}: {
  status?: ComplaintStatus;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<PartnerComplaintsPage>({
    queryKey: partnerComplaintKeys.list(status, limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status,
        limit: String(limit),
      });
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/partner/complaints?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: PartnerComplaint[];
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

export function useResolveComplaintMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { complaintId: string; note?: string }) => {
      const response = await authFetch(`/api/v1/partner/complaints/${input.complaintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'resolve',
          note: input.note,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ status: ComplaintStatus }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerComplaintKeys.all, });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
    },
  });
}

export function useEscalateComplaintMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { complaintId: string; note: string }) => {
      const response = await authFetch(`/api/v1/partner/complaints/${input.complaintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'escalate',
          note: input.note,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ status: ComplaintStatus }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerComplaintKeys.all, });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
    },
  });
}
