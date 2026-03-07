'use client';

import { useMutation } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';
import type { ChatReportReason } from '@/lib/chat/reporting';

export type SubmitChatReportInput = {
  roomId: string;
  reason: ChatReportReason;
  details?: string;
};

export type SubmitChatReportResponse = {
  reportId: string;
  status: 'pending';
  message: string;
};

export function useSubmitChatReportMutation() {
  const authFetch = useAuthenticatedFetch();

  return useMutation<SubmitChatReportResponse, Error, SubmitChatReportInput>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/chat/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          room_id: payload.roomId,
          reason: payload.reason,
          details: payload.details,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<SubmitChatReportResponse>;
    },
  });
}
