import {
createCipheriv,
createDecipheriv,
createHash,
randomBytes
} from 'crypto';

import { z } from 'zod';

import { ProviderConfigError, ProviderValidationError } from '@/lib/providers/errors';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;

export const payoutDestinationInputSchema = z.object({
  channelCode: z.string().trim().min(1, 'Select a payout destination.').max(80),
  accountNumber: z
    .string()
    .trim()
    .min(4, 'Account number is required.')
    .max(64, 'Account number must be 64 characters or less.'),
  accountHolderName: z
    .string()
    .trim()
    .min(2, 'Account holder name is required.')
    .max(120, 'Account holder name must be 120 characters or less.'),
});

export type PayoutDestinationInput = z.infer<typeof payoutDestinationInputSchema>;

export const storedPayoutDestinationSchema = payoutDestinationInputSchema.extend({
  channelName: z.string().trim().min(1),
  channelCategory: z.enum(['BANK', 'EWALLET', 'OTC']),
  currency: z.string().trim().min(1),
});

export type StoredPayoutDestination = z.infer<typeof storedPayoutDestinationSchema>;

export type PayoutDestinationSummary = {
  channelCode: string;
  channelName: string;
  channelCategory: 'BANK' | 'EWALLET' | 'OTC';
  currency: string;
  accountHolderName: string;
  accountNumberMasked: string;
};

function resolveEncryptionKey() {
  const configuredKey =
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY?.trim() ||
    process.env.XENDIT_SECRET_KEY?.trim();

  if (!configuredKey) {
    throw new ProviderConfigError(
      'Financial encryption is not configured. Add FINANCIAL_DATA_ENCRYPTION_KEY or XENDIT_SECRET_KEY.'
    );
  }

  return createHash('sha256').update(configuredKey).digest();
}

export function maskPayoutAccountNumber(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function buildPayoutDestinationSummary(
  destination: StoredPayoutDestination
): PayoutDestinationSummary {
  return {
    channelCode: destination.channelCode,
    channelName: destination.channelName,
    channelCategory: destination.channelCategory,
    currency: destination.currency,
    accountHolderName: destination.accountHolderName,
    accountNumberMasked: maskPayoutAccountNumber(destination.accountNumber),
  };
}

export function encryptPayoutDestination(destination: StoredPayoutDestination) {
  const plaintext = Buffer.from(
    JSON.stringify(storedPayoutDestinationSchema.parse(destination)),
    'utf8'
  );
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, resolveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url')
  ].join('.');
}

export function decryptPayoutDestination(ciphertext: string): StoredPayoutDestination {
  const [ivEncoded, authTagEncoded, payloadEncoded] = ciphertext.split('.');
  if (!ivEncoded || !authTagEncoded || !payloadEncoded) {
    throw new ProviderValidationError('Stored payout destination is malformed.', 500);
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      resolveEncryptionKey(),
      Buffer.from(ivEncoded, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadEncoded, 'base64url')),
      decipher.final()
    ]);

    return storedPayoutDestinationSchema.parse(JSON.parse(decrypted.toString('utf8')));
  } catch (error) {
    throw new ProviderValidationError(
      error instanceof Error
        ? 'Stored payout destination could not be decrypted.'
        : 'Stored payout destination is invalid.',
      500
    );
  }
}

