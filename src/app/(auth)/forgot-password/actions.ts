'use server';

import { randomInt } from 'node:crypto';

import { z } from 'zod';

import { findMockUserByEmail } from '@/data/mock-users';

const schema = z.object({ email: z.string().email('Provide a valid email.'), });

const OTP_LENGTH = 6;

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

function generateOtp() {
  const otp = randomInt(0, 10 ** OTP_LENGTH);
  return otp.toString().padStart(OTP_LENGTH, '0');
}

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

  // In a real implementation, only generate and persist the OTP for existing users.
  const otp = generateOtp();

  const wait = () => new Promise((resolve) => setTimeout(resolve, 800));
  if (targetUser) {
    await wait();
  } else {
    await wait();
  }

  return {
    ok: true,
    mode: 'sent',
    email: normalizedEmail,
    otp,
    message: DEFAULT_SUCCESS_MESSAGE,
  };
}
