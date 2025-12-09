'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'upspace.cached_avatar';

type CachedAvatarPayload = {
  sourceUrl: string;
  dataUrl: string;
  updatedAt: number;
};

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readCachedAvatar = (sourceUrl: string): string | null => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedAvatarPayload>;

    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.sourceUrl === sourceUrl &&
      typeof parsed.dataUrl === 'string'
    ) {
      return parsed.dataUrl;
    }
  } catch {
    return null;
  }

  return null;
};

const persistCachedAvatar = (payload: CachedAvatarPayload) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore cache write failures */
  }
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read avatar blob.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read avatar blob.'));
    reader.readAsDataURL(blob);
  });

const fetchAvatarDataUrl = async (sourceUrl: string, signal: AbortSignal) => {
  const response = await fetch(sourceUrl, {
    cache: 'force-cache',
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    return null;
  }

  return blobToDataUrl(blob);
};

export function useCachedAvatar(sourceUrl: string | null) {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const hydrate = async () => {
      if (!sourceUrl) {
        if (isMounted) {
          setCachedUrl(null);
        }
        return;
      }

      if (sourceUrl.startsWith('data:')) {
        if (isMounted) {
          setCachedUrl(sourceUrl);
        }
        return;
      }

      const cached = readCachedAvatar(sourceUrl);
      if (cached) {
        if (isMounted) {
          setCachedUrl(cached);
        }
        return;
      }

      if (!isMounted) {
        return;
      }

      setCachedUrl(sourceUrl);

      try {
        const dataUrl = await fetchAvatarDataUrl(sourceUrl, controller.signal);
        if (!isMounted || !dataUrl) {
          return;
        }

        setCachedUrl(dataUrl);
        persistCachedAvatar({
          sourceUrl,
          dataUrl,
          updatedAt: Date.now(),
        });
      } catch {
        /* ignore fetch/cache errors */
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [sourceUrl]);

  if (!sourceUrl) {
    return null;
  }

  return cachedUrl ?? sourceUrl;
}
