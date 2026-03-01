'use client';

import { useMutation } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { ChatReportReason } from '@/lib/chat/reporting';

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
