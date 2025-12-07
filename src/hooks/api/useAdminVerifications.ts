'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type VerificationDocument = {
  id: string;
  document_type: string;
  mime_type: string;
  file_size_bytes: number;
  status: string;
  url: string | null;
};

export type PendingVerification = {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  rejected_at: string | null;
  valid_until: string | null;
  space: {
    id: string;
    name: string;
    location: string;
    image_url: string | null;
    is_published: boolean;
    unpublished_at: string | null;
    unpublished_reason: string | null;
    unpublished_by_admin: boolean;
    partner: {
      handle: string;
      name: string;
      avatar_url: string | null;
    };
  };
  documents: VerificationDocument[];
};

export type PendingVerificationsPage = {
  data: PendingVerification[];
  nextCursor: string | null;
};

export type SpaceVisibilityPayload = {
  id: string;
  is_published: boolean;
  unpublished_at: string | null;
  unpublished_reason: string | null;
  unpublished_by_admin: boolean;
};

export const adminVerificationKeys = {
  all: ['admin-verifications'] as const,
  list: (status?: string, limit?: number, cursor?: string | null) =>
    ['admin-verifications', 'list', status ?? 'in_review', limit ?? 20, cursor ?? null] as const,
  detail: (id: string) => ['admin-verifications', 'detail', id] as const,
};

type ApproveVerificationInput = {
  verificationId: string;
  validUntil: string | null;
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

export function usePendingVerificationsQuery({
  status = 'in_review',
  limit = 20,
  cursor,
}: {
  status?: string;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<PendingVerificationsPage>({
    queryKey: adminVerificationKeys.list(status, limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status,
        limit: String(limit),
      });
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/admin/verifications?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const payload = (await response.json()) as {
        data: PendingVerification[];
        nextCursor: string | null;
      };
      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
      };
    },
  });
}

export function useVerificationDetailQuery(verificationId: string | null) {
  const authFetch = useAuthenticatedFetch();

  return useQuery({
    queryKey: adminVerificationKeys.detail(verificationId ?? ''),
    enabled: Boolean(verificationId),
    queryFn: async () => {
      if (!verificationId) {
        return null;
      }
      const response = await authFetch(`/api/v1/admin/verifications/${verificationId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(await parseErrorMessage(response));
      }
      const payload = await response.json();
      return payload.data;
    },
  });
}

export function useApproveVerificationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      verificationId,
      validUntil,
    }: ApproveVerificationInput) => {
      const response = await authFetch(`/api/v1/admin/verifications/${verificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'approve',
          valid_until: validUntil,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVerificationKeys.all, });
    },
  });
}

export function useRejectVerificationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      verificationId,
      reason,
    }: { verificationId: string; reason: string }) => {
      const response = await authFetch(`/api/v1/admin/verifications/${verificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'reject',
          rejected_reason: reason,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVerificationKeys.all, });
    },
  });
}

export function useAdminSpaceVisibilityMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      spaceId,
      action,
      reason,
    }: { spaceId: string; action: 'hide' | 'show'; reason?: string }) => {
      const response = await authFetch(`/api/v1/admin/spaces/${spaceId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ action, reason, }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as { data: SpaceVisibilityPayload; };
      return payload.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVerificationKeys.all, });
    },
  });
}
