'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'upspace.space_create_images';

type PersistedImage = {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

const fileToPersisted = async (file: File): Promise<PersistedImage> => ({
  name: file.name,
  type: file.type,
  lastModified: file.lastModified,
  dataUrl: await readFileAsDataUrl(file),
});

const persistedToFile = async (persisted: PersistedImage): Promise<File> => {
  const response = await fetch(persisted.dataUrl);
  const blob = await response.blob();

  return new File([blob], persisted.name, {
    type: persisted.type || blob.type,
    lastModified: persisted.lastModified,
  });
};

const readStoredImages = (): PersistedImage[] => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item?.dataUrl === 'string') as PersistedImage[];
  } catch {
    return [];
  }
};

const writeStoredImages = async (files: File[]) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (files.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const serialized = await Promise.all(files.map((file) => fileToPersisted(file)));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    /* no-op */
  }
};

const clearStoredImages = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};

export function usePersistentSpaceImages() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      if (!canUseStorage()) {
        if (isMounted) {
          setIsHydrated(true);
        }
        return;
      }

      const stored = readStoredImages();
      if (stored.length === 0) {
        if (isMounted) {
          setIsHydrated(true);
        }
        return;
      }

      try {
        const files = await Promise.all(stored.map((item) => persistedToFile(item)));
        if (isMounted) {
          setSelectedImages(files);
        }
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void writeStoredImages(selectedImages);
  }, [isHydrated, selectedImages]);

  const clearImages = useCallback(() => {
    setSelectedImages([]);
    clearStoredImages();
  }, []);

  return {
    selectedImages,
    setSelectedImages,
    clearImages,
  };
}
