import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { ONBOARDING_PATH, ROLE_REDIRECT_MAP } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return {
 url,
anonKey,
};
}

/**
 * Transfer auth cookies from one response to another so that Supabase session
 * tokens survive redirects.
 */
function transferCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const fallbackPath = requestUrl.searchParams.get('next') ?? '/';
  const fallbackUrl = new URL(fallbackPath, requestUrl.origin);
  fallbackUrl.searchParams.delete('code');
  fallbackUrl.searchParams.delete('state');

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(fallbackUrl);
  }

  const cookieStore = await cookies();
  const defaultResponse = NextResponse.redirect(fallbackUrl);

  try {
    const {
 url, anonKey,
} = getSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            defaultResponse.cookies.set({
              name: cookie.name,
              value: cookie.value,
              ...(cookie.options ?? {}),
            });
          });
        },
      },
    });

    const {
      error, data: sessionData,
    } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Failed to exchange auth code for session', error);
      return defaultResponse;
    }

    const authUserId = sessionData?.user?.id;
    if (!authUserId) {
      return defaultResponse;
    }

    const profile = await prisma.user.findFirst({
      where: { auth_user_id: authUserId, },
      select: {
        is_onboard: true,
        role: true,
      },
    });

    if (!profile) {
      return defaultResponse;
    }

    if (!profile.is_onboard) {
      const onboardUrl = new URL(ONBOARDING_PATH, requestUrl.origin);
      const onboardResponse = NextResponse.redirect(onboardUrl);
      transferCookies(defaultResponse, onboardResponse);
      return onboardResponse;
    }

    const roleRedirect = profile.role
      ? ROLE_REDIRECT_MAP[profile.role]
      : undefined;

    if (roleRedirect) {
      const roleUrl = new URL(roleRedirect, requestUrl.origin);
      const roleResponse = NextResponse.redirect(roleUrl);
      transferCookies(defaultResponse, roleResponse);
      return roleResponse;
    }
  } catch (error) {
    console.error('Unhandled error in Supabase auth callback', error);
  }

  return defaultResponse;
}
