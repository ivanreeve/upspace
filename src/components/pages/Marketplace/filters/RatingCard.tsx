'use client';

import React from 'react';
import { Star } from 'lucide-react';

import { DEFAULT_MIN_RATING, RATING_OPTIONS } from './constants';

import { cn } from '@/lib/utils';

type RatingCardProps = {
  minRating: number;
  onChange: (rating: number) => void;
};

export function RatingCard({
  minRating,
  onChange,
}: RatingCardProps) {
  return (
    <div className="rounded-2xl border border-[#0f5a62]/20 bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#0f5a62]">Minimum rating</span>
        <span className="text-xs font-medium text-muted-foreground">
          { minRating ? `${minRating} star${minRating > 1 ? 's' : ''} & up` : 'Any rating' }
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ () => onChange(DEFAULT_MIN_RATING) }
          className={ cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40',
            minRating === DEFAULT_MIN_RATING
              ? 'border-[#0f5a62] bg-[#0f5a62]/10 text-[#0f5a62] shadow-sm'
              : 'border-transparent bg-background text-muted-foreground hover:border-[#0f5a62]/40 hover:bg-secondary/10 hover:text-[#0f5a62]'
          ) }
        >
          Any rating
        </button>
        { RATING_OPTIONS.map((rating) => {
          const isActive = minRating === rating;
          return (
            <button
              key={ rating }
              type="button"
              onClick={ () => onChange(rating) }
              className={ cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40',
                isActive
                  ? 'border-[#0f5a62] bg-[#0f5a62]/10 text-[#0f5a62] shadow-sm'
                  : 'border-transparent bg-background text-muted-foreground hover:border-[#0f5a62]/40 hover:bg-secondary/10 hover:text-[#0f5a62]'
              ) }
            >
              <span>{ rating }+</span>
              <Star className="size-3" fill={ isActive ? 'currentColor' : 'transparent' } />
            </button>
          );
        }) }
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Highlight spaces that meet your budget and review expectations.
      </p>
    </div>
  );
}
