'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ChatReportReason, ChatReportStatus } from '@/lib/chat/reporting';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

export type AdminChatReport = {
  id: string;
  room_id: string;
  reason: ChatReportReason;
  details: string | null;
  status: ChatReportStatus;
  created_at: string;
  processed_at: string | null;
  resolution_note: string | null;
  space: {
    id: string;
    name: string;
  };
  reporter: {
    role: 'customer' | 'partner' | 'admin';
    handle: string;
    name: string;
  };
  reported_user: {
    role: 'customer' | 'partner' | 'admin';
    handle: string;
    name: string;
  };
  processed_by: {
    name: string;
  } | null;
};

export type AdminChatReportsPage = {
  data: AdminChatReport[];
  nextCursor: string | null;
};

export const adminChatReportKeys = {
  all: ['admin-chat-reports'] as const,
  list: (status?: ChatReportStatus, limit?: number, cursor?: string | null) =>
    ['admin-chat-reports', 'list', status ?? 'pending', limit ?? 20, cursor ?? null] as const,
};

export function useAdminChatReportsQuery({
  status = 'pending',
  limit = 20,
  cursor,
}: {
  status?: ChatReportStatus;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AdminChatReportsPage>({
    queryKey: adminChatReportKeys.list(status, limit, cursor),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status,
        limit: String(limit),
      });
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const response = await authFetch(`/api/v1/admin/chat-reports?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        data: AdminChatReport[];
        nextCursor: string | null;
      };

      return {
        data: payload.data,
        nextCursor: payload.nextCursor ?? null,
      };
    },
  });
}

export function useResolveChatReportMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { reportId: string; note?: string }) => {
      const {
        reportId,
        note,
      } = input;
      const response = await authFetch(`/api/v1/admin/chat-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'resolve',
          resolution_note: note,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ status: ChatReportStatus }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminChatReportKeys.all, });
    },
  });
}

export function useDismissChatReportMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { reportId: string; note: string }) => {
      const {
        reportId,
        note,
      } = input;
      const response = await authFetch(`/api/v1/admin/chat-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          action: 'dismiss',
          resolution_note: note,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<{ status: ChatReportStatus }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminChatReportKeys.all, });
    },
  });
}
