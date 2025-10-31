'use client';

export type MarketplaceFilterState = {
  q: string;
  amenities: string[];
  priceRange: [number, number];
  minRating: number;
};

export const PRICE_RANGE_MIN = 0;
export const PRICE_RANGE_MAX = 10000;
export const PRICE_RANGE_STEP = 250;
export const DEFAULT_PRICE_RANGE: [number, number] = [1500, 4500];
export const DEFAULT_MIN_RATING = 0;
export const MAX_AMENITIES = 10;

export const RATING_OPTIONS = [5, 4, 3, 2, 1] as const;

export const DEFAULT_FILTER_STATE: MarketplaceFilterState = {
  q: '',
  amenities: [],
  priceRange: [...DEFAULT_PRICE_RANGE] as [number, number],
  minRating: DEFAULT_MIN_RATING,
};
