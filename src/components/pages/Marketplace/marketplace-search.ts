'use client';

import type { ListSpacesParams } from '@/lib/api/spaces';
import { AMENITY_CATEGORY_DISPLAY_MAP } from '@/lib/amenity/amenity_category_display_map';

export type FiltersState = {
  q: string;
  region: string;
  city: string;
  barangay: string;
  amenities: string[];
  amenitiesMode: 'all' | 'any';
  amenitiesNegate: boolean;
};

export const DEFAULT_FILTERS: FiltersState = {
  q: '',
  region: '',
  city: '',
  barangay: '',
  amenities: [],
  amenitiesMode: 'any',
  amenitiesNegate: false,
};

export const ORDERED_AMENITY_CATEGORIES = Object.keys(AMENITY_CATEGORY_DISPLAY_MAP);

export const normalizeFilterValue = (value?: string) => (value ?? '').trim();

export const normalizeAmenityValues = (amenities?: string[]) =>
  Array.from(
    new Set(
      (amenities ?? [])
        .map((value) => normalizeFilterValue(value))
        .filter(Boolean)
    )
  );

export const areFiltersEqual = (a: FiltersState, b: FiltersState) => {
  if (
    a.q !== b.q
    || a.region !== b.region
    || a.city !== b.city
    || a.barangay !== b.barangay
    || a.amenitiesMode !== b.amenitiesMode
    || a.amenitiesNegate !== b.amenitiesNegate
  ) {
    return false;
  }

  if (a.amenities.length !== b.amenities.length) return false;

  for (let index = 0; index < a.amenities.length; index += 1) {
    if (a.amenities[index] !== b.amenities[index]) {
      return false;
    }
  }

  return true;
};

export const buildQueryParams = (filters: FiltersState): ListSpacesParams => {
  const amenities = normalizeAmenityValues(filters.amenities);
  const hasAmenities = amenities.length > 0;

  return {
    limit: 24,
    q: normalizeFilterValue(filters.q) || undefined,
    region: normalizeFilterValue(filters.region) || undefined,
    city: normalizeFilterValue(filters.city) || undefined,
    barangay: normalizeFilterValue(filters.barangay) || undefined,
    amenities: hasAmenities ? amenities : undefined,
    amenities_mode: hasAmenities ? filters.amenitiesMode : undefined,
    amenities_negate: hasAmenities ? filters.amenitiesNegate : undefined,
    include_pending: true,
  };
};

type SearchParamsLike = Pick<URLSearchParams, 'get'>;

const parseAmenityValues = (raw: string | null) => {
  if (!raw) return [];
  return normalizeAmenityValues(raw.split(','));
};

export const filtersFromSearchParams = (searchParams?: SearchParamsLike | null): FiltersState => {
  if (!searchParams) {
    return DEFAULT_FILTERS;
  }

  const amenities = parseAmenityValues(searchParams.get('amenities'));
  const hasAmenities = amenities.length > 0;
  const amenitiesModeParam = searchParams.get('amenities_mode');
  const amenitiesNegateParam = searchParams.get('amenities_negate');
  const amenitiesMode = amenitiesModeParam === 'all' || amenitiesModeParam === 'any'
    ? amenitiesModeParam
    : 'any';
  const amenitiesNegate = amenitiesNegateParam === 'true';

  return {
    q: normalizeFilterValue(searchParams.get('q') ?? ''),
    region: normalizeFilterValue(searchParams.get('region') ?? ''),
    city: normalizeFilterValue(searchParams.get('city') ?? ''),
    barangay: normalizeFilterValue(searchParams.get('barangay') ?? ''),
    amenities,
    amenitiesMode: hasAmenities ? amenitiesMode : 'any',
    amenitiesNegate: hasAmenities ? amenitiesNegate : false,
  };
};

export const filtersToSearchParams = (filters: FiltersState) => {
  const params = new URLSearchParams();
  const normalizedQuery = normalizeFilterValue(filters.q);
  const normalizedRegion = normalizeFilterValue(filters.region);
  const normalizedCity = normalizeFilterValue(filters.city);
  const normalizedBarangay = normalizeFilterValue(filters.barangay);
  const amenities = normalizeAmenityValues(filters.amenities);
  const hasAmenities = amenities.length > 0;

  if (normalizedQuery) params.set('q', normalizedQuery);
  if (normalizedRegion) params.set('region', normalizedRegion);
  if (normalizedCity) params.set('city', normalizedCity);
  if (normalizedBarangay) params.set('barangay', normalizedBarangay);
  if (hasAmenities) {
    params.set('amenities', amenities.join(','));
    params.set('amenities_mode', filters.amenitiesMode);
    params.set('amenities_negate', String(filters.amenitiesNegate));
  }

  return params;
};
