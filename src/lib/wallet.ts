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
