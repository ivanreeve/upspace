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

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearSpaceFormDraft();
        clearStoredPhotoState();
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

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
