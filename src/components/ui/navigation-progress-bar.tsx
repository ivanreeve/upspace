'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

const PROGRESS_INCREMENT_RANGE = [4, 8];

const getRandomIncrement = () => {
  const [min, max] = PROGRESS_INCREMENT_RANGE;
  return Math.random() * (max - min) + min;
};

const isInternalLink = (element: Element) => {
  if (!(element instanceof HTMLAnchorElement)) return false;
  if (!element.href) return false;
  const url = new URL(element.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return false;
  if (element.target && element.target !== '_self') return false;
  if (element.hasAttribute('download')) return false;
  const rel = element.getAttribute('rel');
  if (rel?.includes('external')) return false;
  return true;
};

export function NavigationProgressBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const incrementRef = useRef<NodeJS.Timeout | null>(null);
  const hideRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    setVisible(true);
    setProgress((prev) => (prev === 0 ? 12 : Math.max(prev, 12)));
    if (!incrementRef.current) {
      incrementRef.current = setInterval(() => {
        setProgress((prev) => Math.min(prev + getRandomIncrement(), 90));
      }, 200);
    }
  }, []);

  const finishProgress = useCallback(() => {
    if (incrementRef.current) {
      clearInterval(incrementRef.current);
      incrementRef.current = null;
    }
    setProgress(100);
    hideRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      hideRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    if (visible) {
      finishProgress();
    }
  }, [pathname, visible, finishProgress]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const path = event.composedPath ? event.composedPath() : [];
      const anchor =
        path.find((node): node is Element => node instanceof Element && node.tagName === 'A') ??
        (event.target instanceof Element ? event.target : null);

      if (!anchor || !isInternalLink(anchor)) return;
      startProgress();
    };

    const handlePopstate = () => {
      startProgress();
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopstate);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [startProgress]);

  useEffect(() => {
    const originalPush = router.push;
    const originalReplace = router.replace;
    const originalBack = router.back;
    const originalForward = router.forward;

    router.push = (...args) => {
      startProgress();
      return originalPush.apply(router, args);
    };
    router.replace = (...args) => {
      startProgress();
      return originalReplace.apply(router, args);
    };
    router.back = () => {
      startProgress();
      return originalBack.apply(router);
    };
    router.forward = () => {
      startProgress();
      return originalForward.apply(router);
    };

    return () => {
      router.push = originalPush;
      router.replace = originalReplace;
      router.back = originalBack;
      router.forward = originalForward;
    };
  }, [router, startProgress]);

  useEffect(() => {
    return () => {
      if (incrementRef.current) {
        clearInterval(incrementRef.current);
      }
      if (hideRef.current) {
        clearTimeout(hideRef.current);
      }
    };
  }, []);

  const visibilityClass = visible ? 'opacity-100' : 'opacity-0';

  const progressStyle = { width: `${progress}%`, };
  const containerClassName = `pointer-events-none fixed inset-x-0 top-0 z-[999] transition-opacity duration-200 ${visibilityClass}`;

  return (
    <div className={ containerClassName }>
      <div className="h-1 w-full bg-transparent">
        <div
          role="status"
          aria-live="polite"
          className="h-full bg-secondary shadow-[0_0_10px_rgba(15,23,42,0.35)] transition-[width] duration-200 ease-out"
          style={ progressStyle }
        />
      </div>
    </div>
  );
}
