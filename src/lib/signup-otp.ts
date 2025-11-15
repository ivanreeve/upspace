import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/email';

const OTP_EXPIRATION_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60_000;

export class OtpResendBlockedError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('OTP resend blocked by cooldown.');
    this.name = 'OtpResendBlockedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp: string, key: string) {
  return createHash('sha256').update(`${key}|${otp}`).digest('hex');
}

export async function requestSignupOtp(email: string) {
  const existingOtp = await prisma.signup_otps.findFirst({
    where: { email, },
    orderBy: { created_at: 'desc', },
    select: {
      created_at: true,
    },
  });

  if (existingOtp?.created_at) {
    const elapsedMs = Date.now() - existingOtp.created_at.getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      throw new OtpResendBlockedError(retryAfterSeconds);
    }
  }

  const otp = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);
  const issuedAt = new Date();
  const hash = hashOtp(otp, email);

  await prisma.$transaction(async (tx) => {
    // We don't have a reliable unique constraint for upsert, so replace any existing record manually.
    await tx.signup_otps.deleteMany({ where: { email, }, });
    await tx.signup_otps.create({
      data: {
        email,
        hash,
        expires_at: expiresAt,
        created_at: issuedAt,
      },
    });
  });

  await sendOtpEmail({
    to: email,
    otp,
    expiresAt,
    subject: 'Verify your Upspace account',
    appName: 'Upspace',
    cause: 'verifying your Upspace account',
    validForMinutes: OTP_EXPIRATION_MS / 60_000,
  });
}

export async function verifySignupOtp(email: string, otp: string) {
  const entry = await prisma.signup_otps.findFirst({
    where: { email, },
    orderBy: { created_at: 'desc', },
  });
  if (!entry) {
    return false;
  }

  const { expires_at: expiresAt, } = entry;
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return false;
  }

  const hashed = hashOtp(otp, email);

  let expectedHashBuffer: Buffer;
  let providedHashBuffer: Buffer;

  try {
    expectedHashBuffer = Buffer.from(entry.hash, 'hex');
    providedHashBuffer = Buffer.from(hashed, 'hex');
  } catch (error) {
    console.warn('Failed to parse signup OTP hash', error);
    return false;
  }

  if (
    expectedHashBuffer.length !== providedHashBuffer.length ||
    !timingSafeEqual(expectedHashBuffer, providedHashBuffer)
  ) {
    return false;
  }

  return true;
}

export async function clearSignupOtp(email: string) {
  await prisma.signup_otps.deleteMany({ where: { email, }, });
}
