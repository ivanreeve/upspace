'use server';

import { AuthError } from 'next-auth';
import { z } from 'zod';

import { signIn } from '@/lib/auth';

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
    const redirectTarget = await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
      redirectTo: callbackUrl,
    });

    const redirectTo =
      typeof redirectTarget === 'string'
        ? redirectTarget
        : redirectTarget?.toString() ?? callbackUrl;

    return {
      ok: true,
      redirectTo,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        return {
          ok: false,
          message: 'Invalid email or password.',
        };
      }

      return {
        ok: false,
        message: 'Unable to sign in. Please try again.',
      };
    }

    throw error;
  }
}
