'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ONBOARDING_PATH, PUBLIC_PATHS, ROLE_REDIRECT_MAP } from '@/lib/constants';
import { useSession } from '@/components/auth/SessionProvider';
import { useUserProfile } from '@/hooks/use-user-profile';

export function OnboardingRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    data: profile,
    isLoading,
    isError: isProfileError,
  } = useUserProfile();
  const {
    session,
    isLoading: isSessionLoading,
  } = useSession();

  const isOnboardingRoute =
    pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
  const isOnPublicRoute = PUBLIC_PATHS.has(pathname);
  const isSessionResolved = Boolean(session) || !isSessionLoading;
  const redirectTarget = profile?.role ? ROLE_REDIRECT_MAP[profile.role] : '/marketplace';

  useEffect(() => {
    if (!isSessionResolved || isLoading || !session) {
      return;
    }

    // If the profile failed to load, do not redirect.  The middleware already
    // handles server-side redirects for authenticated users on public routes,
    // so a client-side redirect here would race with it and could send users
    // to the wrong destination (e.g. admins ending up on /marketplace).
    if (!profile && isProfileError) {
      return;
    }

    if (!profile) {
      return;
    }

    if (!profile.isOnboard) {
      if (!isOnboardingRoute) {
        router.replace(ONBOARDING_PATH);
      }
      return;
    }

    if (isOnboardingRoute) {
      router.replace(redirectTarget);
      return;
    }

    if (isOnPublicRoute && pathname !== redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [
    isOnboardingRoute,
    isOnPublicRoute,
    isLoading,
    isProfileError,
    profile,
    redirectTarget,
    router,
    session,
    isSessionResolved,
    pathname
  ]);

  return null;
}
