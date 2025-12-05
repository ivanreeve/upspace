export const PUBLIC_PATHS = new Set<string>([
  '/',
  '/signup',
  '/forgot-password',
  '/docs',
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.svg',
  '/openapi.json'
]);
export const PUBLIC_PATH_PREFIXES = ['/marketplace'];
export const IGNORED_PREFIXES = ['/api', '/_next', '/static', '/assets', '/img', '/fonts'];
export const ONBOARDING_PATH = '/onboarding';
export const ROLE_REDIRECT_MAP: Record<string, string> = {
  customer: '/marketplace',
  partner: '/spaces',
  admin: '/admin',
};

export const ROLE_ACCESS_MAP: Record<string, string[]> = {
  customer: ['/marketplace', '/messages', '/account', '/bookmarks', '/notifications'],
  partner: ['/spaces', '/marketplace', '/account', '/notifications'],
  admin: ['/marketplace', '/admin'],
};
