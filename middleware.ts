import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAuthSessionMissingError } from '@supabase/supabase-js';

const PUBLIC_PATHS = new Set<string>(['/', '/signup', '/forgot-password']);
const IGNORED_PREFIXES = ['/api', '/_next', '/static', '/assets'];
const ONBOARDING_PATH = '/onboarding';
const ROLE_REDIRECT_MAP: Record<string, string> = {
  customer: '/marketplace',
  partner: '/spaces',
  admin: '/admin',
};

export async function middleware(request: NextRequest) {
  const { pathname, } = request.nextUrl;
  const isOnboardingPath =
    pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);

  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

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
    console.log('Middleware user data:', userData);

    if (!user) {
      if (isOnboardingPath) {
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }

      if (PUBLIC_PATHS.has(pathname)) {
        return response;
      }

      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }

    const {
      data: profile, error,
    } = await supabase
      .from('user')
      .select('is_onboard, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch user profile in middleware', error);
      return response;
    }

    if (!profile?.is_onboard) {
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
  } catch (error) {
    console.error('Supabase middleware error', error);
  }

  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'], };
