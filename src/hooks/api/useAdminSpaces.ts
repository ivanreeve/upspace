'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type AdminSpace = {
  id: string;
  name: string;
  ownerName: string;
  city: string;
  region: string;
  isPublished: boolean;
  unpublishedAt: string | null;
  unpublishedByAdmin: boolean;
  updatedAt: string | null;
};

export type AdminSpacesPage = {
  data: AdminSpace[];
  nextCursor: string | null;
};

export const adminSpacesKeys = {
  all: ['admin-spaces'] as const,
  list: (search?: string, limit?: number, cursor?: string | null) =>
    ['admin-spaces', 'list', search ?? null, limit ?? 20, cursor ?? null] as const,
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

export function useAdminSpacesQuery({
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

  return useQuery<AdminSpacesPage>({
    queryKey: adminSpacesKeys.list(normalizedSearch, limit, cursor),
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), });
      if (normalizedSearch) {
        params.set('search', normalizedSearch);
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/admin/spaces?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: AdminSpace[];
        nextCursor: string | null;
      };

      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
      };
    },
  });
}
