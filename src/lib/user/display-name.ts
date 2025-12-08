export function formatUserDisplayName(
  first?: string | null,
  last?: string | null,
  fallback?: string
) {
  const parts = [first, last]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length) {
    return parts.join(' ');
  }

  if (fallback?.trim()) {
    return fallback.trim();
  }

  return 'UpSpace member';
}
