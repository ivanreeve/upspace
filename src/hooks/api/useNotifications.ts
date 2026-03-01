'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { NotificationRecord } from '@/lib/notifications/types';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters?: { type?: string }) => ['notifications', 'list', filters] as const,
};

type NotificationsPage = {
  data: NotificationRecord[];
  pagination: { hasMore: boolean; nextCursor: string | undefined };
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

export function useNotificationsQuery(options?: {
  enabled?: boolean;
  type?: string;
  limit?: number;
}) {
  const authFetch = useAuthenticatedFetch();
  const enabled = options?.enabled ?? true;
  const limit = options?.limit ?? 25;
  const type = options?.type;

  return useInfiniteQuery<NotificationsPage>({
    queryKey: notificationKeys.list({ type, }),
    queryFn: async ({ pageParam, }) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (pageParam) params.set('cursor', pageParam as string);
      if (type) params.set('type', type);

      const response = await authFetch(`/api/v1/notifications?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      return await response.json() as NotificationsPage;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    enabled,
    retry: 1,
    staleTime: 1000 * 30,
  });
}

export function useMarkNotificationRead() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<NotificationRecord, Error, { notificationId: string; read?: boolean }>({
    mutationFn: async ({
      notificationId,
      read = true,
    }) => {
      const response = await authFetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          notificationId,
          read,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return payload.data as NotificationRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<{ updatedCount: number }, Error, void>({
    mutationFn: async () => {
      const response = await authFetch('/api/v1/notifications/mark-all', { method: 'PATCH', });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return (payload?.data ?? { updatedCount: 0, }) as { updatedCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
    },
  });
}

export function useDeleteNotification() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<{ deleted: boolean }, Error, { notificationId: string }>({
    mutationFn: async ({ notificationId, }) => {
      const response = await authFetch('/api/v1/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ notificationId, }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return payload.data as { deleted: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
    },
  });
}
