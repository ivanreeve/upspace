const SMART_PUNCTUATION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u201C\u201D]/g, '"'],
  [/[\u2018\u2019]/g, "'"],
  [/[\u2013\u2014]/g, '-'],
  [/\u2026/g, '...']
];

const stripNonLatin1 = (value: string): string =>
  value.replace(/[^\x00-\xFF]/g, '');

export const sanitizeOpenRouterString = (value: string): string => {
  const replaced = SMART_PUNCTUATION_REPLACEMENTS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    value
  );

  return stripNonLatin1(replaced);
};

export const sanitizeOpenRouterJson = (value: unknown): string =>
  sanitizeOpenRouterString(JSON.stringify(value));

export const normalizeOpenRouterApiKey = (value: string): string =>
  value
    .trim()
    .replace(/^[\"'\u201C\u201D\u2018\u2019]+/, '')
    .replace(/[\"'\u201C\u201D\u2018\u2019]+$/, '');

export const hasNonLatin1Chars = (value: string): boolean =>
  /[^\x00-\xFF]/.test(value);
