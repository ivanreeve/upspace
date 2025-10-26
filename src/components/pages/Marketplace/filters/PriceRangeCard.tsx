'use client';

import React from 'react';

import { PRICE_RANGE_MAX, PRICE_RANGE_MIN, PRICE_RANGE_STEP } from './constants';

import { Slider } from '@/components/ui/slider';

type PriceRangeCardProps = {
  priceRange: [number, number];
  formatCurrency: (value: number) => string;
  onChange: (value: number[]) => void;
};

export function PriceRangeCard({
  priceRange,
  formatCurrency,
  onChange,
}: PriceRangeCardProps) {
  const [minPrice, maxPrice] = priceRange;

  return (
    <div className="rounded-xl border border-border/60 bg-background px-5 py-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">Monthly price range</span>
        <span className="text-sm font-semibold text-primary">
          { formatCurrency(minPrice) } – { formatCurrency(maxPrice) }
        </span>
      </div>
      <div className="mt-4">
        <Slider
          min={ PRICE_RANGE_MIN }
          max={ PRICE_RANGE_MAX }
          step={ PRICE_RANGE_STEP }
          value={ priceRange }
          onValueChange={ onChange }
          aria-label="Monthly price range"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{ formatCurrency(PRICE_RANGE_MIN) }</span>
          <span>{ formatCurrency(PRICE_RANGE_MAX) }</span>
        </div>
      </div>
    </div>
  );
}
