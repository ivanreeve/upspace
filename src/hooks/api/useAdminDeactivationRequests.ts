'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { useSession } from '@/components/auth/SessionProvider';
import { type DeactivationReasonCategory } from '@/lib/deactivation-requests';

export type DeactivationRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason_category: DeactivationReasonCategory;
  custom_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
  email: string;
  user: {
    handle: string;
    name: string;
  };
  processed_by: {
    name: string;
  } | null;
};

export type DeactivationRequestsPage = {
  data: DeactivationRequest[];
  nextCursor: string | null;
};

export const adminDeactivationRequestKeys = {
  all: ['admin-deactivation-requests'] as const,
  list: (status?: string, limit?: number, cursor?: string | null) =>
    ['admin-deactivation-requests', 'list', status ?? 'pending', limit ?? 20, cursor ?? null] as const,
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

export function useAdminDeactivationRequestsQuery({
  status = 'pending',
  limit = 20,
  cursor,
}: {
  status?: string;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();
  const {
    session,
    isLoading,
  } = useSession();
  const isSessionReady = Boolean(session && !isLoading);
  const REFRESH_INTERVAL_MS = 15_000;

  return useQuery<DeactivationRequestsPage>({
    enabled: isSessionReady,
    queryKey: adminDeactivationRequestKeys.list(status, limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status,
        limit: String(limit),
      });
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/admin/deactivation-requests?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const payload = (await response.json()) as {
        data: DeactivationRequest[];
        nextCursor: string | null;
      };

      return {
        data: [...payload.data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        nextCursor: payload.nextCursor ?? null,
      };
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useApproveDeactivationRequestMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, }: { requestId: string }) => {
      const response = await authFetch(`/api/v1/admin/deactivation-requests/${requestId}`, {
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
      queryClient.invalidateQueries({ queryKey: adminDeactivationRequestKeys.all, });
    },
  });
}

export function useRejectDeactivationRequestMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
 requestId, reason, 
}: { requestId: string; reason: string }) => {
      const response = await authFetch(`/api/v1/admin/deactivation-requests/${requestId}`, {
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
      queryClient.invalidateQueries({ queryKey: adminDeactivationRequestKeys.all, });
    },
  });
}
