import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile() {
  const [isHydrated, setIsHydrated] = React.useState(false);
  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  }, []);

  const subscribe = React.useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => {};

    const mediaQuery = window.matchMedia(QUERY);
    const notify = () => onStoreChange();

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', notify);
      return () => mediaQuery.removeEventListener('change', notify);
    }

    // Safari < 14 fallback.
    if ('addListener' in mediaQuery) {
      // @ts-expect-error - addListener exists on older Safari.
      mediaQuery.addListener(notify);
      return () => {
        // @ts-expect-error - removeListener exists on older Safari.
        mediaQuery.removeListener(notify);
      };
    }

    return () => {};
  }, []);

  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, () => false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated ? snapshot : false;
}
