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
    <div className="rounded-2xl border border-[#0f5a62]/20 bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#0f5a62]">Monthly price range</span>
        <span className="text-sm font-semibold text-[#0f5a62]">
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
