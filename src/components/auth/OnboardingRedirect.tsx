'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ONBOARDING_PATH } from '@/lib/constants';
import { useUserProfile } from '@/hooks/use-user-profile';

export function OnboardingRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    data: profile,
    isLoading,
    isFetching,
  } = useUserProfile();

  const isOnboardingRoute =
    pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
  const isProfileLoading = isLoading || isFetching;
  const needsOnboarding = Boolean(profile && !profile.isOnboard);

  useEffect(() => {
    if (isOnboardingRoute || isProfileLoading || !needsOnboarding) {
      return;
    }

    router.replace(ONBOARDING_PATH);
  }, [isOnboardingRoute, isProfileLoading, needsOnboarding, router]);

  return null;
}
