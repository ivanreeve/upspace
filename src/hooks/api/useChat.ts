'use client';

import {
  useQuery,
  useQueryClient,
  useMutation,
  type UseQueryOptions
} from '@tanstack/react-query';

import type { ChatMessage, ChatRoomDetail, ChatRoomSummary } from '@/types/chat';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

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

export const chatKeys = {
  rooms: ['chat-rooms'] as const,
  roomDetail: (spaceId: string) => ['chat-room', 'space', spaceId] as const,
  messages: (roomId: string) => ['chat-room', 'messages', roomId] as const,
};

type SendMessageInput = {
  roomId?: string;
  spaceId?: string;
  content: string;
};

type SendMessageResponse = {
  roomId: string;
  message: ChatMessage;
};

export function useCustomerChatRoom(spaceId: string | null) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<ChatRoomDetail | null>({
    queryKey: spaceId ? chatKeys.roomDetail(spaceId) : ['chat-room', 'space', spaceId],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      if (!spaceId) {
        return null;
      }

      const params = new URLSearchParams({ space_id: spaceId, });
      const response = await authFetch(`/api/v1/chat/rooms?${params.toString()}`);

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return payload.room as ChatRoomDetail | null;
    },
  });
}

export type UseChatRoomsOptions = Omit<UseQueryOptions<ChatRoomSummary[]>, 'queryKey' | 'queryFn'>;

function useChatRooms(options?: UseChatRoomsOptions) {
  const authFetch = useAuthenticatedFetch();
  const {
    refetchOnWindowFocus,
    ...restOptions
  } = options ?? {};

  return useQuery<ChatRoomSummary[]>({
    queryKey: chatKeys.rooms,
    queryFn: async () => {
      const response = await authFetch('/api/v1/chat/rooms');
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return (payload.rooms ?? []) as ChatRoomSummary[];
    },
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
    ...restOptions,
  });
}

export function usePartnerChatRooms(options?: UseChatRoomsOptions) {
  return useChatRooms(options);
}

export function useCustomerChatRooms(options?: UseChatRoomsOptions) {
  return useChatRooms(options);
}

export function useChatMessages(roomId: string | null) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<ChatMessage[]>({
    queryKey: roomId ? chatKeys.messages(roomId) : ['chat-room', 'messages', roomId],
    enabled: Boolean(roomId),
    queryFn: async () => {
      if (!roomId) {
        return [];
      }

      const params = new URLSearchParams({ room_id: roomId, });
      const response = await authFetch(`/api/v1/chat/messages?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = await response.json();
      return (payload.messages ?? []) as ChatMessage[];
    },
    refetchOnWindowFocus: false,
  });
}

export function useSendChatMessage() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendMessageInput>({
    mutationFn: async (payload) => {
      const response = await authFetch('/api/v1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          room_id: payload.roomId,
          space_id: payload.spaceId,
          content: payload.content,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<SendMessageResponse>;
    },
    onSuccess: (data, variables) => {
      if (variables.spaceId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.roomDetail(variables.spaceId), });
      }
      if (data.roomId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(data.roomId), });
      }
      queryClient.invalidateQueries({ queryKey: chatKeys.rooms, });
    },
  });
}
