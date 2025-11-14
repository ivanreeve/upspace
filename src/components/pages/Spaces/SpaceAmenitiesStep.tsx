'use client';

import { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { FiAlertCircle, FiList, FiRefreshCw } from 'react-icons/fi';

import { SpaceFormValues } from './SpaceForms';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AMENITY_CATEGORY_DISPLAY_MAP } from '@/lib/amenity/amenity_category_display_map';
import { AMENITY_ICON_MAPPINGS } from '@/lib/amenity/amenity_icon_mappings';
import { cn } from '@/lib/utils';

type AmenityChoice = {
  id: string;
  name: string;
  category: keyof typeof AMENITY_CATEGORY_DISPLAY_MAP | string;
  identifier: string | null;
};

type AmenityResponse = {
  data: AmenityChoice[];
};

type SpaceAmenitiesStepProps = {
  form: UseFormReturn<SpaceFormValues>;
};

const orderedCategories = Object.keys(AMENITY_CATEGORY_DISPLAY_MAP);

export function SpaceAmenitiesStep({ form, }: SpaceAmenitiesStepProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['amenity-choices'],
    queryFn: async (): Promise<AmenityChoice[]> => {
      const response = await fetch('/api/v1/amenities/choices');
      if (!response.ok) {
        throw new Error('Failed to fetch amenity choices');
      }

      const payload = (await response.json()) as AmenityResponse;
      return payload.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const groupedAmenities = useMemo(() => {
    if (!data) return [];

    const grouped = new Map<string, AmenityChoice[]>();
    for (const amenity of data) {
      const group = grouped.get(amenity.category) ?? [];
      group.push(amenity);
      grouped.set(amenity.category, group);
    }

    const ordered: { key: string; label: string; amenities: AmenityChoice[]; }[] = [];

    for (const key of orderedCategories) {
      if (!grouped.has(key)) continue;
      ordered.push({
        key,
        label: AMENITY_CATEGORY_DISPLAY_MAP[key] ?? key,
        amenities: grouped.get(key)?.slice() ?? [],
      });
      grouped.delete(key);
    }

    // Include categories that might not be mapped yet.
    for (const [key, amenities] of grouped.entries()) {
      ordered.push({
        key,
        label: AMENITY_CATEGORY_DISPLAY_MAP[key] ?? key,
        amenities: amenities.slice(),
      });
    }

    return ordered;
  }, [data]);

  return (
    <FormField
      control={ form.control }
      name="amenities"
      render={ ({ field, }) => {
        const selected = field.value ?? [];

        const handleCheckedChange = (amenityId: string, checked: boolean) => {
          if (checked) {
            if (!selected.includes(amenityId)) {
              field.onChange([...selected, amenityId]);
            }
            return;
          }

          field.onChange(selected.filter((value) => value !== amenityId));
        };

        return (
          <FormItem>
            <FormLabel>Included amenities</FormLabel>
            <FormDescription>Select at least two of the core amenities and services offered in this space.</FormDescription>
            <div className="mt-4 space-y-6">
              { isLoading ? (
                <AmenitiesSkeleton />
              ) : isError ? (
                <AmenitiesErrorState onRetry={ refetch } />
              ) : groupedAmenities.length === 0 ? (
                <EmptyAmenitiesState />
              ) : (
                groupedAmenities.map((group) => (
                  <section key={ group.key } className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-base font-semibold text-foreground">{ group.label }</h3>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        { group.amenities.length } option{ group.amenities.length === 1 ? '' : 's' }
                      </p>
                    </div>
                    <ul className="space-y-2">
                      { group.amenities.map((amenity) => {
                        const checkboxId = `amenity-${amenity.id}`;
                        const Icon = amenity.identifier
                          ? AMENITY_ICON_MAPPINGS[amenity.identifier] ?? FiList
                          : FiList;
                        const checked = selected.includes(amenity.id);

                        return (
                          <li key={ amenity.id }>
                            <div
                              className={ cn(
                                'rounded-xl border border-border/60 bg-background/50 px-4 py-3 transition hover:border-primary/50',
                                checked && 'border-primary bg-primary/5 shadow-sm'
                              ) }
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={ checkboxId }
                                  checked={ checked }
                                  onCheckedChange={ (state) => handleCheckedChange(amenity.id, state === true) }
                                  aria-label={ `Toggle amenity ${amenity.name}` }
                                />
                                <Label
                                  htmlFor={ checkboxId }
                                  className="flex w-full cursor-pointer items-center gap-3 text-base font-medium text-foreground"
                                >
                                  <Icon className="size-4 text-foreground" aria-hidden="true" />
                                  <span>{ amenity.name }</span>
                                </Label>
                              </div>
                            </div>
                          </li>
                        );
                      }) }
                    </ul>
                  </section>
                ))
              ) }
            </div>
            <p className="text-sm text-muted-foreground">
              { selected.length } selected · choose at least two to continue.
            </p>
            <FormMessage />
          </FormItem>
        );
      } }
    />
  );
}

function AmenitiesSkeleton() {
  return (
    <div className="space-y-4">
      { Array.from({ length: 3, }).map((_, index) => (
        <div key={ `skeleton-${index}` } className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-2">
            { Array.from({ length: 3, }).map((__, itemIndex) => (
              <Skeleton key={ `skeleton-item-${itemIndex}` } className="h-12 w-full rounded-xl" />
            )) }
          </div>
        </div>
      )) }
    </div>
  );
}

function AmenitiesErrorState({ onRetry, }: { onRetry: () => Promise<unknown>; }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-center gap-2 font-semibold">
        <FiAlertCircle className="size-4" aria-hidden="true" />
        Unable to load amenities.
      </div>
      <p className="text-xs text-destructive/80">Check your connection and try again.</p>
      <Button type="button" variant="ghost" size="sm" onClick={ () => onRetry() } className="inline-flex items-center gap-2">
        <FiRefreshCw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}

function EmptyAmenitiesState() {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
      No amenity choices available yet.
    </div>
  );
}
