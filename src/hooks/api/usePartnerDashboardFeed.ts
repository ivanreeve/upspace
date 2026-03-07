'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';
import type { DashboardFeedItem } from '@/types/dashboard-feed';

const dashboardFeedKeys = {
  base: ['partner-dashboard-feed'] as const,
  list: (limit: number) => ['partner-dashboard-feed', limit] as const,
};

export function usePartnerDashboardFeedQuery(
  limit = 25,
  options?: Omit<
    UseQueryOptions<DashboardFeedItem[], Error>,
    'queryKey' | 'queryFn'
  >
) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<DashboardFeedItem[]>({
    queryKey: dashboardFeedKeys.list(limit),
    queryFn: async () => {
      const query = limit ? `?limit=${ limit }` : '';
      const response = await authFetch(`/api/v1/partner/dashboard-feed${ query }`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, 'Unable to load dashboard feed.'));
      }
      const payload = await response.json();
      return (payload?.data ?? []) as DashboardFeedItem[];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    ...options,
  });
}
