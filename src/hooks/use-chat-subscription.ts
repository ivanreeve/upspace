'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChat';
import type { ChatMessage, ChatRoomSummary } from '@/types/chat';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type SubscriptionCallback = (message: ChatMessage) => void;

export function useChatSubscription(roomId: string | null, onMessage: SubscriptionCallback) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) {
      return undefined;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat_room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message',
          filter: `room_id=eq.${roomId}`,
        },
        ({ new: newMessage, }) => {
          if (!newMessage) return;
          const payload: ChatMessage = {
            id: newMessage.id,
            roomId: newMessage.room_id,
            content: newMessage.content,
            senderId: newMessage.sender_id?.toString() ?? '',
            senderRole: newMessage.sender_role,
            senderName: null,
            createdAt: newMessage.created_at ?? new Date().toISOString(),
          };
          onMessage(payload);
          queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(roomId), (previous = []) => {
            if (previous.some((entry) => entry.id === payload.id)) {
              return previous;
            }
            return [...previous, payload];
          });
          queryClient.setQueryData<ChatRoomSummary[]>(chatKeys.rooms, (previous) => {
            if (!previous) {
              return previous;
            }
            return previous.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    lastMessage: payload,
                  }
                : room
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onMessage, queryClient]);
}

export function useChatRoomsSubscription(roomIds: string[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomIds.length) {
      return undefined;
    }

    const supabase = getSupabaseBrowserClient();
    const filter =
      roomIds.length === 1
        ? `room_id=eq.${roomIds[0]}`
        : `room_id=in.(${roomIds.map((id) => `"${id}"`).join(',')})`;

    const channel = supabase
      .channel(`chat-rooms:${roomIds.join(',')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message',
          filter,
        },
        ({ new: newMessage, }) => {
          if (!newMessage) return;
          const payload: ChatMessage = {
            id: newMessage.id,
            roomId: newMessage.room_id,
            content: newMessage.content,
            senderId: newMessage.sender_id?.toString() ?? '',
            senderRole: newMessage.sender_role,
            senderName: null,
            createdAt: newMessage.created_at ?? new Date().toISOString(),
          };

          queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(payload.roomId), (previous = []) => {
            if (previous.some((entry) => entry.id === payload.id)) {
              return previous;
            }
            return [...previous, payload];
          });

          queryClient.setQueryData<ChatRoomSummary[]>(chatKeys.rooms, (previous) => {
            if (!previous) {
              return previous;
            }
            return previous.map((room) =>
              room.id === payload.roomId
                ? {
                    ...room,
                    lastMessage: payload,
                  }
                : room
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, roomIds]);
}
