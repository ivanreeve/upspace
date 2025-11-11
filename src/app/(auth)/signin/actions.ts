'use server';

import { AuthApiError } from '@supabase/supabase-js';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROLE_REDIRECT_MAP } from '@/lib/constants';

const schema = z
  .object({
    email: z.string().email('Provide a valid email.'),
    password: z
      .string()
      .min(8, 'Minimum 8 characters.')
      .regex(/[A-Z]/, 'Include at least one uppercase letter.')
      .regex(/[a-z]/, 'Include at least one lowercase letter.')
      .regex(/[0-9]/, 'Include at least one number.')
      .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.'),
  });

export type LoginState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  redirectTo?: string;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  
  const data = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []])
    );
    return {
      ok: false,
      errors: fieldErrors,
      message: 'Fix the highlighted fields.',
    };
  }

  const callbackUrl = String(formData.get('callbackUrl') ?? '/');

  try {
    const supabase = await createSupabaseServerClient();

    const {
 data: signInData, error, 
} = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 400) {
          return {
            ok: false,
            message: 'Invalid email or password.',
          };
        }
        if (error.status === 403) {
          return {
            ok: false,
            message: 'Confirm your email address before signing in.',
          };
        }
      }

      return {
        ok: false,
        message: 'Unable to sign in. Please try again.',
      };
    }

    const authedUser = signInData?.user;

    if (!authedUser) {
      console.warn('Supabase sign-in succeeded but returned no user payload');
      return {
        ok: true,
        redirectTo: callbackUrl,
      };
    }

    const {
 data: profile, error: profileError, 
} = await supabase
      .from('user')
      .select('is_onboard, role, is_disabled')
      .eq('auth_user_id', authedUser.id)
      .maybeSingle();

    if (profile?.is_disabled) {
      await supabase.auth.signOut();

      return {
        ok: false,
        message: 'Your account has been disabled. Contact support for help.',
      };
    }

    if (profileError) {
      console.error('Failed to fetch user onboarding state after sign-in', profileError);
    }

    const shouldOnboard = Boolean(profileError) || !profile?.is_onboard;

    if (shouldOnboard) {
      return {
        ok: true,
        redirectTo: '/onboarding',
      };
    }

    const roleRedirect = profile?.role ? ROLE_REDIRECT_MAP[profile.role] : undefined;

    return {
      ok: true,
      redirectTo: roleRedirect ?? callbackUrl,
    };
  } catch (error) {
    console.error('Failed to sign in with Supabase', error);
    return {
      ok: false,
      message: 'Unable to sign in. Please try again.',
    };
  }
}
