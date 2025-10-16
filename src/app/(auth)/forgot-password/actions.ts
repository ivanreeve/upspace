'use server';

import { z } from 'zod';

import { findMockUserByEmail } from '@/data/mock-users';

const schema = z.object({ email: z.string().email('Provide a valid email.'), });

export type ForgotPasswordState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '');

  const parsed = schema.safeParse({ email, });
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

  // Simulate the reset flow without leaking user existence to the client.
  const normalizedEmail = parsed.data.email.toLowerCase();
  const targetUser = findMockUserByEmail(normalizedEmail);

  if (targetUser) {
    // In a real implementation, trigger email delivery here.
    await new Promise((resolve) => setTimeout(resolve, 800));
  } else {
    // Perform an equivalent delay to avoid timing side-channels.
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return {
    ok: true,
    message:
      'If that email is registered with Upspace, you will receive password reset instructions shortly.',
  };
}
