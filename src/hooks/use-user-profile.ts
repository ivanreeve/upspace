'use client';

import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/components/auth/SessionProvider';

export type UserProfile = {
  userId: string;
  handle: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  avatar: string | null;
  isOnboard: boolean;
  role: 'customer' | 'partner' | 'admin';
  birthday: string | null;
  status: 'active' | 'deactivated' | 'pending_deletion' | 'deleted';
  pendingDeletionAt: string | null;
  expiresAt: string | null;
};

export function useUserProfile() {
  const { session, } = useSession();

  return useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/v1/auth/profile', {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Unable to load user profile.');
      }

      return response.json();
    },
    enabled: Boolean(session),
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
}
