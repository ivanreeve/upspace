'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/components/auth/SessionProvider';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';
import type { PartnerProviderAccountView } from '@/lib/financial/provider-account-view';

export const partnerProviderAccountKeys = {
  all: ['partner-provider-account'] as const,
  status: (refresh = false) => ['partner-provider-account', 'status', refresh ? 'refresh' : 'cached'] as const,
};

export function usePartnerProviderAccountQuery({
  refresh = false,
  enabled = true,
}: {
  refresh?: boolean;
  enabled?: boolean;
} = {}) {
  const authFetch = useAuthenticatedFetch();
  const {
    session,
    isLoading,
  } = useSession();

  return useQuery<PartnerProviderAccountView>({
    enabled: enabled && Boolean(session && !isLoading),
    queryKey: partnerProviderAccountKeys.status(refresh),
    queryFn: async () => {
      const response = await authFetch(
        `/api/v1/financial/provider-account/status${refresh ? '?refresh=1' : ''}`
      );

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json();
    },
    staleTime: refresh ? 0 : 60_000,
  });
}

export function useEnablePartnerProviderAccountMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await authFetch('/api/v1/financial/provider-account', { method: 'POST', });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<PartnerProviderAccountView>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerProviderAccountKeys.all, });
    },
  });
}

export function useRefreshPartnerProviderAccountMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await authFetch('/api/v1/financial/provider-account/status?refresh=1');

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<PartnerProviderAccountView>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(partnerProviderAccountKeys.status(false), data);
      queryClient.invalidateQueries({ queryKey: partnerProviderAccountKeys.all, });
    },
  });
}
