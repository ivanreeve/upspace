'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

export type UnpublishRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
  space: {
    id: string;
    name: string;
    is_published: boolean;
    owner_name: string;
  };
  requester: {
    name: string;
  };
  processed_by: {
    name: string;
  } | null;
};

export type UnpublishRequestsPage = {
  data: UnpublishRequest[];
  nextCursor: string | null;
};

export const adminUnpublishRequestKeys = {
  all: ['admin-unpublish-requests'] as const,
  list: (status?: string, limit?: number, cursor?: string | null) =>
    ['admin-unpublish-requests', 'list', status ?? 'pending', limit ?? 20, cursor ?? null] as const,
};

export function useAdminUnpublishRequestsQuery({
  status = 'pending',
  limit = 20,
  cursor,
}: {
  status?: string;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<UnpublishRequestsPage>({
    queryKey: adminUnpublishRequestKeys.list(status, limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
 status,
limit: String(limit), 
});
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/admin/unpublish-requests?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as { data: UnpublishRequest[]; nextCursor: string | null; };
      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
      };
    },
  });
}

export function useApproveUnpublishRequestMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, }: { requestId: string }) => {
      const response = await authFetch(`/api/v1/admin/unpublish-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ action: 'approve', }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUnpublishRequestKeys.all, });
    },
  });
}

export function useRejectUnpublishRequestMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
 requestId, reason, 
}: { requestId: string; reason: string; }) => {
      const response = await authFetch(`/api/v1/admin/unpublish-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUnpublishRequestKeys.all, });
    },
  });
}
