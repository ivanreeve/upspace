'use server';

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendOtpEmail } from '@/lib/email';

const requestSchema = z.object({ email: z.string().email('Provide a valid email.'), });

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[0-9]/, 'Include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.');

const DEFAULT_SUCCESS_MESSAGE =
  'If that email is registered with Upspace, you will receive a 6-digit code shortly.';
const INVALID_OTP_MESSAGE = 'The code you entered is incorrect or has expired.';

export type ForgotPasswordState = {
  ok: boolean;
  mode?: 'sent';
  email?: string;
  otp?: string;
  message?: string;
  errors?: Record<string, string[]>;
  expiresAt?: string;
  retryAfterSeconds?: number;
};

export type ResetPasswordResult = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<'otp' | 'password', string[]>>;
};

const OTP_EXPIRATION_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60_000;

type PasswordResetMetadata = {
  hash: string;
  expires_at: string;
  issued_at?: string;
};

function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp: string, userId: string) {
  return createHash('sha256').update(`${userId}|${otp}`).digest('hex');
}

function invalidOtpResponse() {
  return {
    ok: false as const,
    message: INVALID_OTP_MESSAGE,
    errors: { otp: [INVALID_OTP_MESSAGE], },
  };
}

async function setPasswordResetMetadata(
  userId: string,
  hash: string,
  expiresAt: Date,
  issuedAt: Date
) {
  const entry = JSON.stringify({
    password_reset: {
      hash,
      expires_at: expiresAt.toISOString(),
      issued_at: issuedAt.toISOString(),
    },
  });

  await prisma.$executeRaw`
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || ${entry}::jsonb
    WHERE id = ${userId}::uuid
  `;
}

async function clearPasswordResetMetadata(userId: string) {
  await prisma.$executeRaw`
    UPDATE auth.users
    SET raw_user_meta_data = (COALESCE(raw_user_meta_data, '{}'::jsonb) - 'password_reset')
    WHERE id = ${userId}::uuid
  `;
}

async function findAuthUserByEmail(email: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; user_metadata: Prisma.JsonValue | null }>
  >`
    SELECT id, raw_user_meta_data AS user_metadata
    FROM auth.users
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `;

  const authUser = rows[0] ?? null;
  if (!authUser) return null;

  const registeredProfile = await prisma.user.findFirst({
    where: {
      auth_user_id: authUser.id,
      is_disabled: false,
    },
    select: { user_id: true, },
  });

  if (!registeredProfile) return null;

  return authUser;
}

function parsePasswordResetMetadata(value: unknown): PasswordResetMetadata | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const metadata = candidate.password_reset;
  if (!metadata || typeof metadata !== 'object') return null;

  const details = metadata as Record<string, unknown>;
  const hash = typeof details.hash === 'string' ? details.hash : undefined;
  const expiresAt = typeof details.expires_at === 'string' ? details.expires_at : undefined;
  const issuedAt = typeof details.issued_at === 'string' ? details.issued_at : undefined;

  if (!hash || !expiresAt) return null;

  return {
    hash,
    expires_at: expiresAt,
    issued_at: issuedAt,
  };
}

const otpSchema = z.object({
  email: z.string().email('Provide a valid email.'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code we emailed to you.'),
});

const resetSchema = otpSchema.extend({ password: passwordSchema, });

type VerifiedOtpResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      message: string;
      errors: Partial<Record<'otp', string[]>>;
    };

async function verifyPasswordResetOtp(email: string, otp: string): Promise<VerifiedOtpResult> {
  const user = await findAuthUserByEmail(email.toLowerCase());

  if (!user) {
    return invalidOtpResponse();
  }

  const metadata = parsePasswordResetMetadata(user.user_metadata);
  if (!metadata) {
    return invalidOtpResponse();
  }

  const expiresAt = new Date(metadata.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return invalidOtpResponse();
  }

  const hashed = hashOtp(otp, user.id);
  let expectedHashBuffer: Buffer;
  let providedHashBuffer: Buffer;

  try {
    expectedHashBuffer = Buffer.from(metadata.hash, 'hex');
    providedHashBuffer = Buffer.from(hashed, 'hex');
  } catch (_error) {
    return invalidOtpResponse();
  }

  if (
    expectedHashBuffer.length !== providedHashBuffer.length ||
    !timingSafeEqual(expectedHashBuffer, providedHashBuffer)
  ) {
    return invalidOtpResponse();
  }

  return {
    ok: true,
    userId: user.id,
  };
}

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
    const user = await findAuthUserByEmail(normalizedEmail);
    if (!user) {
      return {
        ok: false,
        errors: { email: ['No account found with that email address.'], },
        message: 'Enter the email you use for your Upspace account.',
      };
    }

    const existingMetadata = parsePasswordResetMetadata(user.user_metadata);
    if (existingMetadata?.issued_at) {
      const issuedAt = new Date(existingMetadata.issued_at);
      const elapsedMs = Date.now() - issuedAt.getTime();

      if (!Number.isNaN(issuedAt.getTime()) && elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        const message = `Please wait ${retryAfterSeconds} seconds before requesting another code.`;

        return {
          ok: false,
          errors: { email: [message], },
          message,
          retryAfterSeconds,
        };
      }
    }

    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);
    const issuedAt = new Date();
    const hashed = hashOtp(otp, user.id);

    await setPasswordResetMetadata(user.id, hashed, expiresAt, issuedAt);
    try {
      await sendOtpEmail({
        to: normalizedEmail,
        otp,
        expiresAt,
        subject: 'Reset your Upspace password',
        appName: 'Upspace',
        cause: 'resetting your password',
        validForMinutes: OTP_EXPIRATION_MS / 60_000,
      });
    } catch (error) {
      console.error('Failed to send password reset email', error);
      await clearPasswordResetMetadata(user.id).catch(() => null);
      return {
        ok: false,
        message: 'Unable to send reset code. Please try again later.',
      };
    }

    return {
      ok: true,
      mode: 'sent',
      email: normalizedEmail,
      message: DEFAULT_SUCCESS_MESSAGE,
      expiresAt: expiresAt.toISOString(),
      retryAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    };
  } catch (error) {
    console.error('Failed to send password reset code', error);
    return {
      ok: false,
      message: 'Unable to send reset code. Please try again later.',
    };
  }
}

export async function validateResetOtpAction(payload: {
  email: string;
  otp: string;
}): Promise<ResetPasswordResult> {
  const parsed = otpSchema.safeParse(payload);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: 'Fix the highlighted fields.',
      errors: { otp: fieldErrors.otp, },
    };
  }

  try {
    const validation = await verifyPasswordResetOtp(parsed.data.email, parsed.data.otp);
    if (!validation.ok) {
      return validation;
    }

    return {
      ok: true,
      message: 'Code verified. You can set a new password now.',
    };
  } catch (error) {
    console.error('Failed to validate password reset OTP', error);
    return {
      ok: false,
      message: INVALID_OTP_MESSAGE,
      errors: { otp: [INVALID_OTP_MESSAGE], },
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
    const validation = await verifyPasswordResetOtp(
      parsed.data.email,
      parsed.data.otp
    );

    if (!validation.ok) {
      return validation;
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error: updateError, } = await supabaseAdmin.auth.admin.updateUserById(
      validation.userId,
      /* eslint-disable object-curly-newline */
      {
        password: parsed.data.password,
      }
    );
    /* eslint-enable object-curly-newline */

    if (updateError) {
      console.error('Failed to update password via Supabase', updateError);
      return {
        ok: false,
        message: 'Unable to reset password right now. Please try again.',
      };
    }

    try {
      await clearPasswordResetMetadata(validation.userId);
    } catch (error) {
      console.warn('Failed to clear password reset metadata', error);
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
