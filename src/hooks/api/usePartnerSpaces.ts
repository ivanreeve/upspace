'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AreaRecord, SpaceRecord } from '@/data/spaces';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { AreaFormValues, SpaceFormValues } from '@/lib/validations/spaces';

export const partnerSpacesKeys = {
  all: ['partner-spaces'] as const,
  list: () => ['partner-spaces', 'list'] as const,
  detail: (spaceId: string) => ['partner-spaces', 'detail', spaceId] as const,
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

export function usePartnerSpacesQuery() {
  const authFetch = useAuthenticatedFetch();

  return useQuery<SpaceRecord[]>({
    queryKey: partnerSpacesKeys.list(),
    queryFn: async () => {
      const response = await authFetch('/api/v1/partner/spaces');
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as { data: SpaceRecord[] };
      return payload.data;
    },
  });
}

export function usePartnerSpaceQuery(spaceId: string | null) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<SpaceRecord | null>({
    queryKey: partnerSpacesKeys.detail(spaceId ?? ''),
    enabled: Boolean(spaceId),
    queryFn: async () => {
      if (!spaceId) {
        return null;
      }

      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as { data: SpaceRecord };
      return payload.data;
    },
  });
}

export function useCreateAreaMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AreaFormValues) => {
      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = (await response.json()) as { data: AreaRecord };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}

export function useUpdateAreaMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      areaId,
      payload,
    }: {
      areaId: string;
      payload: AreaFormValues;
    }) => {
      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/areas/${areaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = (await response.json()) as { data: AreaRecord };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}

export function useDeleteAreaMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (areaId: string) => {
      if (!spaceId) {
        throw new Error('Space ID is required to delete an area.');
      }

      const response = await authFetch(
        `/api/v1/partner/spaces/${spaceId}/areas/${areaId}`,
        { method: 'DELETE', }
      );

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return areaId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}

export function useUpdatePartnerSpaceMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SpaceFormValues) => {
      if (!spaceId) {
        throw new Error('Space ID is required to update a listing.');
      }

      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = (await response.json()) as { data: SpaceRecord };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}
