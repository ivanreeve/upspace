export const SIDEBAR_STATE_COOKIE = 'sidebar_state';

export function parseSidebarState(value?: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
