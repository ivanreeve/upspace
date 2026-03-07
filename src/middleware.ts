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

/**
 * Create a redirect response that preserves any Set-Cookie headers from the
 * original `response` (e.g. refreshed Supabase auth tokens).  Without this,
 * token rotation during `getUser()` writes new cookies to `response`, but a
 * bare `NextResponse.redirect()` creates a *new* response that drops them —
 * leaving the browser with an invalidated refresh token and logging the user out.
 */
function redirectWithCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);

  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });

  return redirect;
}

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
        return redirectWithCookies(homeUrl, response);
      }

      if (isPathPublic(pathname)) {
        return response;
      }

      const homeUrl = new URL('/', request.url);
      return redirectWithCookies(homeUrl, response);
    }

    // Build the cookie header from the original request cookies, then overlay
    // any cookies that were refreshed by the getUser() call above (e.g. rotated
    // Supabase auth tokens).  Without this, internal fetches would send stale
    // tokens that have already been consumed by the middleware's own getUser().
    const cookieMap = new Map<string, string>();
    for (const cookie of request.cookies.getAll()) {
      cookieMap.set(cookie.name, `${cookie.name}=${cookie.value}`);
    }
    for (const cookie of response.cookies.getAll()) {
      cookieMap.set(cookie.name, `${cookie.name}=${cookie.value}`);
    }

    const sharedHeaders = new Headers();
    const mergedCookieHeader = Array.from(cookieMap.values()).join('; ');

    if (mergedCookieHeader) {
      sharedHeaders.set('cookie', mergedCookieHeader);
    }

    sharedHeaders.set('x-upspace-internal-call', '1');

    // Only sync profile if we haven't already synced in this session
    const hasSynced = request.cookies.get('upspace_synced')?.value === '1';
    if (!hasSynced) {
      const syncProfileUrl = new URL('/api/v1/auth/sync-profile', request.url);
      const syncResponse = await fetch(syncProfileUrl, {
        method: 'POST',
        headers: new Headers(sharedHeaders),
        cache: 'no-store',
      });

      if (syncResponse.ok) {
        // Mark as synced for 5 minutes to avoid redundant calls
        response.cookies.set('upspace_synced', '1', {
          path: '/',
          maxAge: 300,
          httpOnly: true,
          sameSite: 'lax',
        });
      } else {
        console.error(
          'Failed to sync user profile in middleware',
          syncResponse.status,
          syncResponse.statusText
        );
      }
    }

    const profileUrl = new URL('/api/v1/auth/profile', request.url);
    const profileResponse = await fetch(profileUrl, {
      headers: new Headers(sharedHeaders),
      cache: 'no-store',
    });

    if (!profileResponse.ok) {
      console.error('Failed to fetch user profile in middleware', profileResponse.status, profileResponse.statusText);
      if (pathname.startsWith('/api/auth')) {
        return response;
      }

      const fallbackUrl = new URL(ONBOARDING_PATH, request.url);
      return redirectWithCookies(fallbackUrl, response);
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

      const fallbackUrl = new URL(ONBOARDING_PATH, request.url);
      return redirectWithCookies(fallbackUrl, response);
    }

    const isOnboard = Boolean(profile?.isOnboard);
    if (!isOnboard) {
      if (isOnboardingPath) {
        return response;
      }

      const onboardingUrl = new URL(ONBOARDING_PATH, request.url);
      return redirectWithCookies(onboardingUrl, response);
    }

    const redirectTarget =
      profile?.role && ROLE_REDIRECT_MAP[profile.role]
        ? ROLE_REDIRECT_MAP[profile.role]
        : '/marketplace';

    if (profile?.role === 'admin' && pathname === '/marketplace/dashboard') {
      const adminDashboardUrl = new URL('/admin/dashboard', request.url);
      return redirectWithCookies(adminDashboardUrl, response);
    }

    if (profile?.role === 'admin' && pathname.startsWith('/marketplace/ai-assistant')) {
      const adminRedirectUrl = new URL(redirectTarget, request.url);
      return redirectWithCookies(adminRedirectUrl, response);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Middleware] Auth user on ${pathname}: onboarded=${isOnboard}, role=${profile?.role}, target=${redirectTarget}`);
    }

    if ((PUBLIC_PATHS.has(pathname) || isOnboardingPath) && redirectTarget) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Middleware] Redirecting ${pathname} → ${redirectTarget}`);
      }
      const targetUrl = new URL(redirectTarget, request.url);
      return redirectWithCookies(targetUrl, response);
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
          return redirectWithCookies(targetUrl, response);
        }
      }
    }
  } catch (error) {
    console.error('Supabase middleware error', error);

    // If an authenticated user's profile fetch failed, redirect to a safe
    // default instead of falling through to a potentially stale page.
    if (!isPathPublic(pathname) || PUBLIC_PATHS.has(pathname)) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (url && anonKey) {
          const supabase = createServerClient(url, anonKey, {
            cookies: {
              getAll() { return request.cookies.getAll(); },
              setAll() { /* read-only check */ },
            },
          });
          const { data, } = await supabase.auth.getUser();
          if (data?.user && PUBLIC_PATHS.has(pathname)) {
            const fallbackUrl = new URL('/marketplace', request.url);
            return redirectWithCookies(fallbackUrl, response);
          }
        }
      } catch {
        // Last-resort: let the page handle it
      }
    }
  }

  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|img).*)'], };
