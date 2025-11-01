import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = new Set<string>(['/', '/signin', '/signup', '/forgot-password']);
const IGNORED_PREFIXES = ['/api', '/_next', '/static', '/assets'];

export async function middleware(request: NextRequest) {
  const { pathname, } = request.nextUrl;

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

    const { data, } = await supabase.auth.getSession();
    const { session, } = data;

    if (!session) {
      return PUBLIC_PATHS.has(pathname) ? response : NextResponse.next();
    }

    if (pathname.startsWith('/onboarding')) {
      return response;
    }

    const {
 data: profile, error, 
} = await supabase
      .from('user')
      .select('is_onboard')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch user profile in middleware', error);
      return response;
    }

    if (!profile?.is_onboard) {
      const onboardingUrl = new URL('/onboarding', request.url);
      return NextResponse.redirect(onboardingUrl);
    }
  } catch (error) {
    console.error('Supabase middleware error', error);
  }

  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'], };
