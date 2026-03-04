'use client';

import {
useCallback,
useEffect,
useRef,
useState
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type TypingUser = {
  userId: string;
  name: string;
};

const TYPING_TIMEOUT_MS = 3000;

/**
 * Provides typing indicator state for a chat room using Supabase Presence.
 *
 * Returns:
 * - `typingUsers`: list of users currently typing (excluding the local user)
 * - `broadcastTyping`: call when the local user types to signal activity
 */
export function useChatTyping(roomId: string | null, localUserId: string | null, localUserName: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !localUserId) {
      setTypingUsers([]);
      return undefined;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`typing:${roomId}`, { config: { presence: { key: localUserId, }, }, });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync', }, () => {
        const state = channel.presenceState<{ userId: string; name: string; typing: boolean }>();
        const users: TypingUser[] = [];

        for (const [key, presences] of Object.entries(state)) {
          if (key === localUserId) continue;
          for (const presence of presences) {
            if (presence.typing) {
              users.push({
 userId: presence.userId,
name: presence.name, 
});
            }
          }
        }

        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: localUserId,
            name: localUserName ?? 'User',
            typing: false,
          });
        }
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, localUserId, localUserName]);

  const broadcastTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !localUserId) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    void channel.track({
      userId: localUserId,
      name: localUserName ?? 'User',
      typing: true,
    });

    debounceRef.current = setTimeout(() => {
      void channel.track({
        userId: localUserId,
        name: localUserName ?? 'User',
        typing: false,
      });
    }, TYPING_TIMEOUT_MS);
  }, [localUserId, localUserName]);

  return {
 typingUsers,
broadcastTyping, 
};
}
