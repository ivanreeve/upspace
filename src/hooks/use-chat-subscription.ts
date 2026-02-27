'use client';

import { useEffect, useRef } from 'react';
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
            return previous.map((room) => {
              if (room.id !== roomId) {
                return room;
              }
              const senderName =
                payload.senderRole === 'customer'
                  ? room.customerName
                  : room.partnerName;
              return {
                ...room,
                lastMessage: {
 ...payload,
senderName, 
},
              };
            });
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
  const roomIdsRef = useRef<string[]>(roomIds);

  const serializedIds = roomIds.slice().sort().join(',');

  useEffect(() => {
    roomIdsRef.current = roomIds;
  }, [roomIds]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat-room:insert:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_room',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: chatKeys.rooms, });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const ids = roomIdsRef.current;
    if (!ids.length) {
      return undefined;
    }

    const supabase = getSupabaseBrowserClient();
    const filter =
      ids.length === 1
        ? `room_id=eq.${ids[0]}`
        : `room_id=in.(${ids.map((id) => `"${id}"`).join(',')})`;

    const channel = supabase
      .channel(`chat-rooms:${ids.join(',')}`)
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
            return previous.map((room) => {
              if (room.id !== payload.roomId) {
                return room;
              }
              const senderName =
                payload.senderRole === 'customer'
                  ? room.customerName
                  : room.partnerName;
              return {
                ...room,
                lastMessage: {
 ...payload,
senderName, 
},
              };
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
     
  }, [queryClient, serializedIds]);
}
