'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions
} from '@tanstack/react-query';

import type { AreaRecord, SpaceRecord } from '@/data/spaces';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { AreaFormValues, SpaceFormValues } from '@/lib/validations/spaces';
import type { PriceRuleFormValues, PriceRuleRecord } from '@/lib/pricing-rules';

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

export function usePartnerSpacesQuery(
  options?: Omit<UseQueryOptions<SpaceRecord[], Error>, 'queryKey' | 'queryFn'>
) {
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
    ...options,
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

export function useCreatePriceRuleMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PriceRuleFormValues) => {
      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/pricing-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = (await response.json()) as { data: PriceRuleRecord };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}

export function useUpdatePriceRuleMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      priceRuleId,
      payload,
    }: {
      priceRuleId: string;
      payload: PriceRuleFormValues;
    }) => {
      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/pricing-rules/${priceRuleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const data = (await response.json()) as { data: PriceRuleRecord };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}

export function useDeletePriceRuleMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (priceRuleId: string) => {
      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/pricing-rules/${priceRuleId}`, { method: 'DELETE', });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return priceRuleId;
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

export function useRequestUnpublishSpaceMutation(spaceId: string) {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reason, }: { reason?: string }) => {
      if (!spaceId) {
        throw new Error('Space ID is required.');
      }

      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/unpublish-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ reason, }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ data: { id: string; status: string; created_at: string } }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}

export function useWithdrawSpaceVerificationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (spaceId: string) => {
      if (!spaceId) {
        throw new Error('Space ID is required to withdraw the application.');
      }

      const response = await authFetch(`/api/v1/partner/spaces/${spaceId}/verification/withdraw`, { method: 'POST', });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: { id: string; status: string; updated_at: string };
      };
      return payload.data;
    },
    onSuccess: (_data, spaceId) => {
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.detail(spaceId), });
    },
  });
}
