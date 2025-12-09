import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAuthSessionMissingError } from '@supabase/supabase-js';

import {
  IGNORED_PREFIXES,
  ONBOARDING_PATH,
  PUBLIC_PATHS,
  PUBLIC_PATH_PREFIXES,
  ROLE_ACCESS_MAP,
  ROLE_REDIRECT_MAP
} from '@/lib/constants';

type MiddlewareProfile = {
  isOnboard?: boolean;
  role?: string | null;
};

export async function middleware(request: NextRequest) {
  if (request.headers.get('x-upspace-internal-call') === '1') {
    return NextResponse.next();
  }

  const { pathname, } = request.nextUrl;
  const isOnboardingPath =
    pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);

  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const isPathPublic = (path: string) => (
    PUBLIC_PATHS.has(path)
    || PUBLIC_PATH_PREFIXES.some((prefix) =>
      path === prefix || path.startsWith(`${prefix}/`)
    )
  );

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return response;
    }

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          });
        },
      },
    });

    const {
      data: userData, error: userError,
    } = await supabase.auth.getUser();
    const isMissingSessionError =
      userError &&
      (isAuthSessionMissingError(userError) ||
        userError.name === 'AuthSessionMissingError' ||
        userError.message?.includes('Auth session missing'));

    if (userError && !isMissingSessionError) {
      console.error('Failed to verify auth user in middleware', userError);
      return response;
    }
    const user = isMissingSessionError ? null : userData?.user;

    if (!user) {
      if (isOnboardingPath) {
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }

      if (isPathPublic(pathname)) {
        return response;
      }

      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }

    const profileUrl = new URL('/api/v1/auth/profile', request.url);
    const profileHeaders = new Headers();
    const cookieHeader = request.headers.get('cookie');

    if (cookieHeader) {
      profileHeaders.set('cookie', cookieHeader);
    }

    profileHeaders.set('x-upspace-internal-call', '1');

    const profileResponse = await fetch(profileUrl, {
      headers: profileHeaders,
      cache: 'no-store',
    });

    if (!profileResponse.ok) {
      console.error('Failed to fetch user profile in middleware', profileResponse.status, profileResponse.statusText);
      if (pathname.startsWith('/api/auth')) {
        return response;
      }

      const landingUrl = new URL('/', request.url);
      return NextResponse.redirect(landingUrl);
    }

    const profilePayload = await profileResponse.json().catch(() => null);
    const profile = profilePayload && typeof profilePayload === 'object'
      ? (profilePayload as MiddlewareProfile)
      : null;

    if (!profile) {
      console.error('Malformed profile payload in middleware');
      if (pathname.startsWith('/api/auth')) {
        return response;
      }

      const landingUrl = new URL('/', request.url);
      return NextResponse.redirect(landingUrl);
    }

    const isOnboard = Boolean(profile?.isOnboard);
    if (!isOnboard) {
      if (isOnboardingPath) {
        return response;
      }

      const onboardingUrl = new URL(ONBOARDING_PATH, request.url);
      return NextResponse.redirect(onboardingUrl);
    }

    const redirectTarget =
      profile?.role && ROLE_REDIRECT_MAP[profile.role]
        ? ROLE_REDIRECT_MAP[profile.role]
        : '/marketplace';

    if ((PUBLIC_PATHS.has(pathname) || isOnboardingPath) && redirectTarget) {
      const targetUrl = new URL(redirectTarget, request.url);
      return NextResponse.redirect(targetUrl);
    }

    if (!PUBLIC_PATHS.has(pathname) && !isOnboardingPath) {
      const allowedPaths = profile?.role ? ROLE_ACCESS_MAP[profile.role] : undefined;

      if (allowedPaths?.length) {
        const canAccessPath = allowedPaths.some((allowedPath) => {
          if (allowedPath === '/') {
            return pathname === '/';
          }

          return (
            pathname === allowedPath ||
            pathname.startsWith(`${allowedPath}/`)
          );
        });

        if (!canAccessPath) {
          const fallbackPath = redirectTarget ?? allowedPaths[0] ?? '/';
          const targetUrl = new URL(fallbackPath, request.url);
          return NextResponse.redirect(targetUrl);
        }
      }
    }
  } catch (error) {
    console.error('Supabase middleware error', error);
  }

  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|img).*)'], };
