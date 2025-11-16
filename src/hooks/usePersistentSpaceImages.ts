'use client';

import {
  useCallback,
  useEffect,
  useState,
  type SetStateAction
} from 'react';

const STORAGE_KEY = 'upspace.space_create_images';

type PersistedImage = {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
};

type PersistedCategory = {
  id: string;
  name: string;
  images: PersistedImage[];
};

type PersistedPhotoState = {
  featuredImage: PersistedImage | null;
  categories: PersistedCategory[];
};

export type SpacePhotoCategory = {
  id: string;
  name: string;
  images: File[];
};

export type SpacePhotoState = {
  featuredImage: File | null;
  categories: SpacePhotoCategory[];
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

const readStoredPhotoState = (): PersistedPhotoState | null => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const featuredImage = parsed.featuredImage && typeof parsed.featuredImage === 'object'
      ? (parsed.featuredImage as PersistedImage)
      : null;

    const categories = Array.isArray(parsed.categories)
      ? (parsed.categories as PersistedCategory[]).filter((category) => typeof category?.id === 'string')
      : [];

    return {
      featuredImage: featuredImage?.dataUrl ? featuredImage : null,
      categories: categories.map((category) => ({
        id: category.id,
        name: typeof category.name === 'string' ? category.name : '',
        images: Array.isArray(category.images)
          ? (category.images.filter((image) => typeof image?.dataUrl === 'string') as PersistedImage[])
          : [],
      })),
    } satisfies PersistedPhotoState;
  } catch {
    return null;
  }
};

const writeStoredPhotoState = async (state: SpacePhotoState) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (!state.featuredImage && state.categories.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const serializedFeatured = state.featuredImage ? await fileToPersisted(state.featuredImage) : null;
    const serializedCategories = await Promise.all(
      state.categories.map(async (category) => ({
        id: category.id,
        name: category.name,
        images: await Promise.all(category.images.map((file) => fileToPersisted(file))),
      }))
    );

    const payload: PersistedPhotoState = {
      featuredImage: serializedFeatured,
      categories: serializedCategories,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* no-op */
  }
};

export const clearStoredPhotoState = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};

const createEmptyPhotoState = (): SpacePhotoState => ({
  featuredImage: null,
  categories: [],
});

const resolveState = <T>(input: SetStateAction<T>, previous: T): T => {
  return typeof input === 'function' ? (input as (prevValue: T) => T)(previous) : input;
};

export function usePersistentSpaceImages() {
  const [photoState, setPhotoState] = useState<SpacePhotoState>(createEmptyPhotoState);
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

      const stored = readStoredPhotoState();
      if (!stored) {
        if (isMounted) {
          setIsHydrated(true);
        }
        return;
      }

      try {
        const featuredImage = stored.featuredImage ? await persistedToFile(stored.featuredImage) : null;
        const categories = await Promise.all(
          stored.categories.map(async (category) => ({
            id: category.id,
            name: category.name,
            images: await Promise.all(category.images.map((image) => persistedToFile(image))),
          }))
        );

        if (isMounted) {
          setPhotoState({
            featuredImage,
            categories,
          });
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

    void writeStoredPhotoState(photoState);
  }, [isHydrated, photoState]);

  const setFeaturedImage = useCallback((updater: SetStateAction<File | null>) => {
    setPhotoState((prev) => ({
      ...prev,
      featuredImage: resolveState(updater, prev.featuredImage),
    }));
  }, []);

  const setCategories = useCallback((updater: SetStateAction<SpacePhotoCategory[]>) => {
    setPhotoState((prev) => ({
      ...prev,
      categories: resolveState(updater, prev.categories),
    }));
  }, []);

  const clearImages = useCallback(() => {
    setPhotoState(createEmptyPhotoState());
    clearStoredPhotoState();
  }, []);

  return {
    featuredImage: photoState.featuredImage,
    categories: photoState.categories,
    setFeaturedImage,
    setCategories,
    clearImages,
    isHydrated,
  };
}
