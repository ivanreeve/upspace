import sanitizeHtml from 'sanitize-html';

const ALLOWED_RICH_TEXT_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li'
] as const;

const NORMALIZE_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
};

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_RICH_TEXT_TAGS,
  allowedAttributes: {},
};

export function sanitizeRichText(value: string) {
  return sanitizeHtml(value ?? '', SANITIZE_OPTIONS);
}

export function richTextToPlainText(value: string) {
  return sanitizeHtml(value ?? '', NORMALIZE_OPTIONS).replace(/\s+/g, ' ').trim();
}

export function richTextPlainTextLength(value: string) {
  return richTextToPlainText(value).length;
}
