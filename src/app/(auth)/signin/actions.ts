'use server';

import { AuthApiError, type Session } from '@supabase/supabase-js';
import { user_status } from '@prisma/client';
import { z } from 'zod';

import { ROLE_REDIRECT_MAP } from '@/lib/constants';
import { reactivateUserIfEligible } from '@/lib/auth/reactivate-user';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type SupabaseSessionPayload = {
  access_token: string;
  refresh_token: string;
};

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
  supabaseSession?: SupabaseSessionPayload;
};

function extractSupabaseSession(session: Session | null): SupabaseSessionPayload | undefined {
  if (!session?.access_token || !session?.refresh_token) {
    return undefined;
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
}


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
    const supabaseSession = extractSupabaseSession(signInData?.session ?? null);

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
        supabaseSession,
      };
    }

    const reactivation = await reactivateUserIfEligible(authedUser.id).catch((err) => {
      console.error('Failed to resolve user status during sign-in', err);
      return null;
    });

    if (!reactivation) {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: 'Unable to verify your account status. Please try again.',
      };
    }

    if (!reactivation.allow) {
      await supabase.auth.signOut();

      const statusMessages: Record<string, string> = {
        deleted: 'Your account has been deleted.',
        deletion_expired: 'Your account was permanently deleted after the grace period.',
        not_found: 'Unable to locate your profile.',
      };

      return {
        ok: false,
        message: statusMessages[reactivation.reason] ?? 'Your account is not active. Contact support for help.',
      };
    }

    const profile = await prisma.user.findUnique({
      where: { auth_user_id: authedUser.id, },
      select: {
        is_onboard: true,
        role: true,
        status: true,
      },
    });

    if (!profile) {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: 'Unable to locate your profile.',
      };
    }

    if (profile.status !== user_status.active) {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: 'Your account is not active. Contact support for help.',
      };
    }

    const shouldOnboard = !profile.is_onboard;

    if (shouldOnboard) {
      return {
        ok: true,
        redirectTo: '/onboarding',
        supabaseSession,
      };
    }

    const roleRedirect = profile?.role ? ROLE_REDIRECT_MAP[profile.role] : undefined;

    return {
      ok: true,
      redirectTo: roleRedirect ?? callbackUrl,
      supabaseSession,
    };
  } catch (error) {
    console.error('Failed to sign in with Supabase', error);
    return {
      ok: false,
      message: 'Unable to sign in. Please try again.',
    };
  }
}
