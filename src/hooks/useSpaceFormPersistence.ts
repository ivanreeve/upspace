'use client';

import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { createSpaceFormDefaults, SpaceFormValues } from '@/components/pages/Spaces/SpaceForms';

const STORAGE_KEY = 'upspace.space_create_form_draft';

const spaceFormDraftSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  unit_number: z.string().optional(),
  address_subunit: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  lat: z.number().optional(),
  long: z.number().optional(),
});

type SpaceFormDraft = z.infer<typeof spaceFormDraftSchema>;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readDraft = (): SpaceFormDraft | null => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const result = spaceFormDraftSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const writeDraft = (values: SpaceFormValues) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    /* no-op: storage quota might be exceeded */
  }
};

export const clearSpaceFormDraft = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};

const mergeDraftWithDefaults = (draft: SpaceFormDraft | null): SpaceFormValues => {
  const defaults = createSpaceFormDefaults();
  if (!draft) {
    return defaults;
  }

  return {
    ...defaults,
    ...draft,
    lat: draft.lat ?? defaults.lat,
    long: draft.long ?? defaults.long,
    amenities: draft.amenities ?? defaults.amenities,
  };
};

export const useSpaceFormPersistence = (form: UseFormReturn<SpaceFormValues>) => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      form.reset(mergeDraftWithDefaults(draft));
    }
    setIsHydrated(true);
  }, [form]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const subscription = form.watch((values) => {
      writeDraft(values as SpaceFormValues);
    });

    return () => subscription.unsubscribe();
  }, [form, isHydrated]);

  return { clearDraft: clearSpaceFormDraft, };
};
