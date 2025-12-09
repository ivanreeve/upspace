'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { DashboardFeedItem } from '@/types/dashboard-feed';

const dashboardFeedKeys = {
  base: ['partner-dashboard-feed'] as const,
  list: (limit: number) => ['partner-dashboard-feed', limit] as const,
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
  return 'Unable to load dashboard feed.';
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
        throw new Error(await parseErrorMessage(response));
      }
      const payload = await response.json();
      return (payload?.data ?? []) as DashboardFeedItem[];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    ...options,
  });
}
