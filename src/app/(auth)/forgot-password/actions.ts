'use server';

import { AuthApiError } from '@supabase/supabase-js';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const requestSchema = z.object({ email: z.string().email('Provide a valid email.'), });

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[0-9]/, 'Include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.');

const resetSchema = z.object({
  email: z.string().email('Provide a valid email.'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code we emailed to you.'),
  password: passwordSchema,
});

const DEFAULT_SUCCESS_MESSAGE =
  'If that email is registered with Upspace, you will receive a 6-digit code shortly.';

export type ForgotPasswordState = {
  ok: boolean;
  mode?: 'sent';
  email?: string;
  otp?: string;
  message?: string;
  errors?: Record<string, string[]>;
};

export type ResetPasswordResult = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<'otp' | 'password', string[]>>;
};

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '');

  const parsed = requestSchema.safeParse({ email, });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [key, value ?? []])
    );

    return {
      ok: false,
      errors: fieldErrors,
      message: 'Fix the highlighted fields.',
    };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const {
      data,
      error,
    } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    });

    if (error) {
      if (
        error instanceof AuthApiError &&
        (error.status === 400 || error.status === 422)
      ) {
        console.warn('Password reset requested for non-existent email', { email: normalizedEmail, });
        return {
          ok: true,
          mode: 'sent',
          email: normalizedEmail,
          message: DEFAULT_SUCCESS_MESSAGE,
        };
      }

      throw error;
    }

    const otp = data?.properties?.email_otp ?? undefined;

    return {
      ok: true,
      mode: 'sent',
      email: normalizedEmail,
      otp,
      message: DEFAULT_SUCCESS_MESSAGE,
    };
  } catch (error) {
    console.error('Failed to generate Supabase password reset link', error);
    return {
      ok: false,
      message: 'Unable to send reset code. Please try again later.',
    };
  }
}

export async function resetPasswordWithOtpAction(payload: {
  email: string;
  otp: string;
  password: string;
}): Promise<ResetPasswordResult> {
  const parsed = resetSchema.safeParse(payload);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: 'Fix the highlighted fields.',
      errors: {
        otp: fieldErrors.otp,
        password: fieldErrors.password,
      },
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const email = parsed.data.email.toLowerCase();
    const otp = parsed.data.otp.trim();

    const { error: verifyError, } = await supabase.auth.verifyOtp({
      type: 'recovery',
      email,
      token: otp,
    });

    if (verifyError) {
      console.warn('Supabase OTP verification failed', verifyError);
      const message = 'The code you entered is incorrect or has expired.';
      return {
        ok: false,
        message,
        errors: { otp: [message], },
      };
    }

    const { error: updateError, } = await supabase.auth.updateUser({ password: parsed.data.password, });

    if (updateError) {
      console.error('Supabase password update failed', updateError);
      return {
        ok: false,
        message: 'Unable to reset password right now. Please try again.',
      };
    }

    const { error: signOutError, } = await supabase.auth.signOut();
    if (signOutError) {
      console.warn('Supabase sign-out after password reset failed', signOutError);
    }

    return {
      ok: true,
      message: 'Password updated successfully.',
    };
  } catch (error) {
    console.error('Failed to reset password through Supabase', error);
    return {
      ok: false,
      message: 'Unable to reset password. Request a new code and try again.',
    };
  }
}
