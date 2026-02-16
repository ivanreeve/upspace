'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type AiConversationSummary = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AiConversationMessage = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  space_results: unknown[] | null;
  booking_action: Record<string, unknown> | null;
  created_at: string;
};

export type AiConversationDetail = AiConversationSummary & {
  messages: AiConversationMessage[];
};

export const aiConversationKeys = {
  all: ['ai-conversations'] as const,
  detail: (id: string) => ['ai-conversations', id] as const,
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    /* ignore */
  }
  return 'Something went wrong. Please try again.';
};

export function useAiConversationsQuery() {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AiConversationSummary[]>({
    queryKey: aiConversationKeys.all,
    queryFn: async () => {
      const response = await authFetch('/api/v1/ai/conversations');
      if (!response.ok) throw new Error(await parseErrorMessage(response));
      const payload = await response.json();
      return (payload.conversations ?? []) as AiConversationSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAiConversationQuery(id: string | null) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AiConversationDetail | null>({
    queryKey: id ? aiConversationKeys.detail(id) : ['ai-conversations', 'none'],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await authFetch(`/api/v1/ai/conversations/${id}`);
      if (!response.ok) throw new Error(await parseErrorMessage(response));
      const payload = await response.json();
      return payload.conversation as AiConversationDetail;
    },
  });
}

export function useCreateAiConversationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<AiConversationSummary, Error, { title?: string } | void>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ title: (payload as { title?: string } | undefined)?.title, }),
      });
      if (!response.ok) throw new Error(await parseErrorMessage(response));
      const data = await response.json();
      return data.conversation as AiConversationSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConversationKeys.all, });
    },
  });
}

export function useDeleteAiConversationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const response = await authFetch(`/api/v1/ai/conversations/${id}`, { method: 'DELETE', });
      if (!response.ok) throw new Error(await parseErrorMessage(response));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConversationKeys.all, });
    },
  });
}

export function useRenameAiConversationMutation() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<AiConversationSummary, Error, { id: string; title: string }>({
    mutationFn: async ({
 id, title, 
}) => {
      const response = await authFetch(`/api/v1/ai/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ title, }),
      });
      if (!response.ok) throw new Error(await parseErrorMessage(response));
      const data = await response.json();
      return data.conversation as AiConversationSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConversationKeys.all, });
    },
  });
}
