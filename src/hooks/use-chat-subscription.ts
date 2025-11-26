'use client';

import { useEffect } from 'react';

import type { ChatMessage } from '@/types/chat';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type SubscriptionCallback = (message: ChatMessage) => void;

export function useChatSubscription(roomId: string | null, onMessage: SubscriptionCallback) {
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onMessage]);
}
