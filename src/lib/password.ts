import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';

const KEYLEN = 64;

/**
 * Hash a password using Node's scrypt for local/demo use.
 * The result packs the salt and derived key as `salt:hash` hex strings.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `${ salt.toString('hex') }:${ derived.toString('hex') }`;
}

/**
 * Verify a password that was hashed with {@link hashPassword}.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEYLEN) return false;

  const actual = scryptSync(password, salt, KEYLEN);

  try {
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
