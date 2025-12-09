'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type AdminUser = {
  id: string;
  handle: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
};

export type AdminUsersPage = {
  data: AdminUser[];
  nextCursor: string | null;
};

export const adminUserKeys = {
  all: ['admin-users'] as const,
  list: (search?: string, limit?: number, cursor?: string | null) =>
    ['admin-users', 'list', search ?? null, limit ?? 20, cursor ?? null] as const,
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

export function useAdminUsersQuery({
  search,
  limit = 20,
  cursor,
}: {
  search?: string;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();
  const trimmedSearch = search?.trim();
  const normalizedSearch = trimmedSearch?.length ? trimmedSearch : undefined;

  return useQuery<AdminUsersPage>({
    queryKey: adminUserKeys.list(normalizedSearch, limit, cursor),
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), });
      if (normalizedSearch) {
        params.set('search', normalizedSearch);
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/admin/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: AdminUser[];
        nextCursor: string | null;
      };

      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
      };
    },
  });
}

export function useAdminDisableUserMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason?: string;
    }) => {
      const response = await authFetch(`/api/v1/admin/users/${userId}/disable`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ reason, }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all, });
    },
  });
}

export function useAdminEnableUserMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason?: string;
    }) => {
      const response = await authFetch(`/api/v1/admin/users/${userId}/enable`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ reason, }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all, });
    },
  });
}
