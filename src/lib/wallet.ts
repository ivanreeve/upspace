const VALID_DISPLAY_AMOUNT_PATTERN = /^\d+(\.\d{0,2})?$/;

/**
 * Convert a user-entered display amount (e.g. "12.50") to minor units (1250)
 * without floating-point multiplication. Returns null for invalid input.
 */
export function parseDisplayAmountToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed || !VALID_DISPLAY_AMOUNT_PATTERN.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ''] = trimmed.split('.');
  const paddedFraction = fraction.padEnd(2, '0');
  const minor = Number(`${whole}${paddedFraction}`);

  if (!Number.isFinite(minor) || minor < 0) {
    return null;
  }

  return minor;
}

/**
 * Convert minor units (e.g. 1250) to a display string ("12.50").
 */
export function formatMinorToDisplay(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = String(minor % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function formatCurrencyMinor(
  amountMinor: string | number | bigint,
  currency = 'PHP'
) {
  const resolved =
    typeof amountMinor === 'string'
      ? Number(amountMinor)
      : typeof amountMinor === 'bigint'
        ? Number(amountMinor)
        : amountMinor;

  if (!Number.isFinite(resolved)) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
    }).format(0);
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
  }).format(resolved / 100);
}
