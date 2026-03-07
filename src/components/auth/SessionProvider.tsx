'use client';

import {
createContext,
useContext,
useEffect,
useMemo,
useState,
type ReactNode
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { clearSpaceFormDraft } from '@/hooks/useSpaceFormPersistence';
import { clearStoredPhotoState } from '@/hooks/usePersistentSpaceImages';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  accessToken: string | null;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
  accessToken: null,
});

export function SessionProvider({ children, }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    setIsLoading(true);
    supabase.auth.getSession()
      .then(({ data, }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    const { data: { subscription, }, } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        clearSpaceFormDraft();
        clearStoredPhotoState();

        // Centralized redirect: always navigate to the landing page after
        // sign-out, regardless of whether the signOut() call itself succeeded
        // or errored.  This prevents stale page content from remaining visible
        // when the session is cleared locally.
        window.location.replace('/');
        return;
      }

      // On SIGNED_IN / TOKEN_REFRESHED, mark the profile query as stale so
      // it refetches in the background.  We use cancelRefetch: false so that
      // an already in-flight query (started by INITIAL_SESSION) is NOT
      // cancelled — avoiding the perpetual-skeleton bug for customers while
      // still ensuring the profile resolves for all roles.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries(
          { queryKey: ['user-profile'], },
          { cancelRefetch: false, }
        );
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      accessToken: session?.access_token ?? null,
    }),
    [session, isLoading]
  );

  return <SessionContext.Provider value={ value }>{ children }</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
