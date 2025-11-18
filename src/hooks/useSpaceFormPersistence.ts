'use client';

import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { createSpaceFormDefaults, SpaceFormValues } from '@/components/pages/Spaces/SpaceForms';

const STORAGE_KEY = 'upspace.space_create_form_draft';

const availabilityDraftSchema = z.record(
  z.string(),
  z.object({
    is_open: z.boolean(),
    opens_at: z.string(),
    closes_at: z.string(),
  })
);

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
  availability: availabilityDraftSchema.optional(),
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

const mergeAvailability = (
  defaults: SpaceFormValues['availability'],
  draftAvailability?: SpaceFormDraft['availability']
): SpaceFormValues['availability'] => {
  const merged: SpaceFormValues['availability'] = Object.entries(defaults).reduce(
    (acc, [day, slot]) => {
      acc[day as keyof SpaceFormValues['availability']] = { ...slot, };
      return acc;
    },
    {} as SpaceFormValues['availability']
  );

  if (!draftAvailability) {
    return merged;
  }

  for (const [day, slot] of Object.entries(draftAvailability)) {
    if (!slot) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(merged, day)) {
      continue;
    }

    merged[day as keyof SpaceFormValues['availability']] = {
      is_open: slot.is_open,
      opens_at: slot.opens_at,
      closes_at: slot.closes_at,
    };
  }

  return merged;
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
    availability: mergeAvailability(defaults.availability, draft.availability),
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

  return {
    clearDraft: clearSpaceFormDraft,
    isHydrated,
  };
};
