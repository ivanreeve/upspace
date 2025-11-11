export const PUBLIC_PATHS = new Set<string>(['/', '/signup', '/forgot-password']);
export const IGNORED_PREFIXES = ['/api', '/_next', '/static', '/assets', '/img'];
export const ONBOARDING_PATH = '/onboarding';
export const ROLE_REDIRECT_MAP: Record<string, string> = {
  customer: '/marketplace',
  partner: '/spaces',
  admin: '/admin',
};
