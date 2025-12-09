import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = requestUrl.searchParams.get('next') ?? '/';
  const redirectUrl = new URL(nextPath, requestUrl.origin);
  redirectUrl.searchParams.delete('code');
  redirectUrl.searchParams.delete('state');

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(redirectUrl);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(redirectUrl);

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
            response.cookies.set({
              name: cookie.name,
              value: cookie.value,
              ...(cookie.options ?? {}),
            });
          });
        },
      },
    });

    const { error, } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Failed to exchange auth code for session', error);
    }
  } catch (error) {
    console.error('Unhandled error in Supabase auth callback', error);
  }

  return response;
}
