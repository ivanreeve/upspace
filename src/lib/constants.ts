export const PUBLIC_PATHS = new Set<string>([
  '/',
  '/signin',
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
  partner: '/partner/spaces',
  admin: '/admin',
};

export const ROLE_ACCESS_MAP: Record<string, string[]> = {
  customer: [
    '/marketplace',
    '/customer',
    '/customer/account',
    '/customer/bookmarks',
    '/customer/messages',
    '/customer/notifications'
  ],
  partner: [
    '/marketplace',
    '/partner',
    '/partner/spaces',
    '/partner/messages',
    '/customer/account',
    '/customer/notifications'
  ],
  admin: ['/marketplace', '/admin'],
};
