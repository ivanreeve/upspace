'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { notificationKeys } from '@/hooks/api/useNotifications';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Subscribes to realtime notification inserts for the given user.
 * Invalidates the notifications query cache so the UI refreshes automatically.
 */
export function useNotificationSubscription(userAuthId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userAuthId) {
      return undefined;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:${userAuthId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notification',
          filter: `user_auth_id=eq.${userAuthId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_notification',
          filter: `user_auth_id=eq.${userAuthId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: notificationKeys.all, });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userAuthId, queryClient]);
}
