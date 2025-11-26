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
  role: 'customer' | 'partner' | 'admin';
};

export function useUserProfile() {
  const { session, } = useSession();

  return useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/v1/auth/profile', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('Unable to load user profile.');
      }

      return response.json();
    },
    enabled: Boolean(session),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
