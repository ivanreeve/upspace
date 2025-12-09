export const dedupeAddressOptions = <T extends { code: string; name: string }>(options: readonly T[]) => {
  const seen = new Set<string>();

  return options.filter((option) => {
    const identifier = `${option.code}-${option.name}`.trim().toLowerCase();
    if (seen.has(identifier)) {
      return false;
    }
    seen.add(identifier);
    return true;
  });
};
