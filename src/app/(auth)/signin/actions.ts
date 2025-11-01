'use server';

import { AuthApiError } from '@supabase/supabase-js';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  email: z.string().email('Provide a valid email.'),
  password: z.string().min(8, 'Minimum 8 characters.'),
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

  const callbackUrl = String(formData.get('callbackUrl') ?? '/dashboard');

  try {
    const supabase = await createSupabaseServerClient();

    const { error, } = await supabase.auth.signInWithPassword({
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

    return {
      ok: true,
      redirectTo: callbackUrl,
    };
  } catch (error) {
    console.error('Failed to sign in with Supabase', error);
    return {
      ok: false,
      message: 'Unable to sign in. Please try again.',
    };
  }
}
