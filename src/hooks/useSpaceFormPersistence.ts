'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { createSpaceFormDefaults } from '@/components/pages/Spaces/SpaceForms';
import type { SpaceFormValues } from '@/lib/validations/spaces';

const STORAGE_KEY = 'upspace.space_create_form_draft';
export type SpaceDraftStep = 1 | 2 | 3 | 4 | 5 | 6;

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

const draftEnvelopeSchema = z.object({
  values: spaceFormDraftSchema,
  saved_at: z.string().optional(),
  step: z.number().int().min(1).max(6).optional(),
});

type SpaceFormDraftEnvelope = z.infer<typeof draftEnvelopeSchema>;

type ParsedSpaceDraft = {
  values: SpaceFormDraft;
  savedAt: string | null;
  step?: SpaceDraftStep;
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parseDraft = (raw: unknown): ParsedSpaceDraft | null => {
  const envelope = draftEnvelopeSchema.safeParse(raw);
  if (envelope.success) {
    return {
      values: envelope.data.values,
      savedAt: envelope.data.saved_at ?? null,
      step: envelope.data.step as SpaceDraftStep | undefined,
    };
  }

  const legacy = spaceFormDraftSchema.safeParse(raw);
  if (legacy.success) {
    return {
      values: legacy.data,
      savedAt: null,
      step: undefined,
    };
  }

  return null;
};

const readDraft = (): ParsedSpaceDraft | null => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parseDraft(parsed);
  } catch {
    return null;
  }
};

const writeDraft = (values: SpaceFormValues, step?: SpaceDraftStep) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    const payload: SpaceFormDraftEnvelope = {
      values,
      saved_at: new Date().toISOString(),
      step,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

export type SpaceDraftSummary = {
  name: string;
  city?: string;
  region?: string;
  savedAt: string;
  step?: SpaceDraftStep;
};

export const readSpaceDraftSummary = (): SpaceDraftSummary | null => {
  const parsed = readDraft();
  if (!parsed) {
    return null;
  }

  const name = (parsed.values.name ?? '').trim();
  const city = (parsed.values.city ?? '').trim();
  const region = (parsed.values.region ?? '').trim();

  return {
    name: name || 'Untitled space',
    city: city || undefined,
    region: region || undefined,
    savedAt: parsed.savedAt ?? new Date().toISOString(),
    step: parsed.step,
  };
};

export const useSpaceDraftSummary = () => {
  const [summary, setSummary] = useState<SpaceDraftSummary | null>(null);

  useEffect(() => {
    if (!canUseStorage()) {
      return;
    }

    const refresh = () => setSummary(readSpaceDraftSummary());
    refresh();

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== STORAGE_KEY) {
        return;
      }
      refresh();
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const refresh = useCallback(() => {
    setSummary(readSpaceDraftSummary());
  }, []);

  return {
    summary,
    refresh,
  };
};

export const useSpaceFormPersistence = (
  form: UseFormReturn<SpaceFormValues>,
  currentStep?: SpaceDraftStep,
  options?: {
    enabled?: boolean;
  }
) => {
  const enabled = options?.enabled ?? true;
  const [isHydrated, setIsHydrated] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const draft = readDraft();
    if (draft) {
      form.reset(mergeDraftWithDefaults(draft.values));
    }
    setIsHydrated(true);
  }, [enabled, form]);

  useEffect(() => {
    if (!enabled || !isHydrated) {
      return;
    }

    const subscription = form.watch((values) => {
      writeDraft(values as SpaceFormValues, currentStep);
    });

    return () => subscription.unsubscribe();
  }, [enabled, form, isHydrated, currentStep]);

  const saveDraft = useCallback(() => {
    if (!enabled) {
      return null;
    }

    const values = form.getValues();
    writeDraft(values as SpaceFormValues, currentStep);
    return readSpaceDraftSummary();
  }, [enabled, form, currentStep]);

  return {
    clearDraft: enabled ? clearSpaceFormDraft : () => {},
    saveDraft,
    isHydrated,
  };
};
