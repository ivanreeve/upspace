import sanitizeHtml from 'sanitize-html';

const BASE_RICH_TEXT_TAGS = [
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
  'li',
  'a'
] as const;

const TABLE_RICH_TEXT_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'] as const;
const TEXT_ALIGN_TAGS = ['p', 'h1', 'h2', 'h3', 'td', 'th'] as const;
const ALLOWED_RICH_TEXT_TAGS = [...BASE_RICH_TEXT_TAGS, ...TABLE_RICH_TEXT_TAGS] as const;

const TABLE_CELL_ATTRIBUTES = ['colspan', 'rowspan', 'data-colwidth'] as const;
const LINK_ATTRIBUTES = ['href', 'target', 'rel'] as const;

const NORMALIZE_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
};

const TEXT_ALIGN_ALLOWED_STYLE = { 'text-align': [/^(left|center|right|justify)$/], };

const TEXT_ALIGN_ALLOWED_STYLES = TEXT_ALIGN_TAGS.reduce<Record<string, Record<string, RegExp[]>>>(
  (styles, tag) => {
    styles[tag] = TEXT_ALIGN_ALLOWED_STYLE;
    return styles;
  },
  {}
);

const SANITIZE_OPTIONS = {
  allowedTags: [...ALLOWED_RICH_TEXT_TAGS],
  allowedAttributes: {
    td: [...TABLE_CELL_ATTRIBUTES, 'style'],
    th: [...TABLE_CELL_ATTRIBUTES, 'style'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    a: [...LINK_ATTRIBUTES],
  },
  allowedStyles: TEXT_ALIGN_ALLOWED_STYLES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
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
