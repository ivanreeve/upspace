'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions
} from '@tanstack/react-query';

import type { NotificationRecord } from '@/lib/notifications/types';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

const notificationKeys = { all: ['notifications'] as const, };

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

export function useNotificationsQuery(
  options?: Omit<UseQueryOptions<NotificationRecord[], Error>, 'queryKey' | 'queryFn'>
) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<NotificationRecord[]>({
    queryKey: notificationKeys.all,
    queryFn: async () => {
      const response = await authFetch('/api/v1/notifications');
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const payload = await response.json();
      return (payload?.data ?? []) as NotificationRecord[];
    },
    ...options,
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
