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
  rejected_reason: string | null;
  space: {
    id: string;
    name: string;
    location: string;
    image_url: string | null;
    partner: {
      handle: string;
      name: string;
    };
  };
  documents: VerificationDocument[];
};

export const adminVerificationKeys = {
  all: ['admin-verifications'] as const,
  list: (status?: string) => ['admin-verifications', 'list', status ?? 'in_review'] as const,
  detail: (id: string) => ['admin-verifications', 'detail', id] as const,
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

export function usePendingVerificationsQuery(status: string = 'in_review') {
  const authFetch = useAuthenticatedFetch();

  return useQuery<PendingVerification[]>({
    queryKey: adminVerificationKeys.list(status),
    queryFn: async () => {
      const response = await authFetch(`/api/v1/admin/verifications?status=${status}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const payload = (await response.json()) as { data: PendingVerification[] };
      return payload.data;
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
    mutationFn: async (verificationId: string) => {
      const response = await authFetch(`/api/v1/admin/verifications/${verificationId}`, {
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
      queryClient.invalidateQueries({ queryKey: adminVerificationKeys.all, });
    },
  });
}

export function useRejectVerificationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
 verificationId, reason, 
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
