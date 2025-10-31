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
    <div className="rounded-xl border border-border/60 bg-background px-5 py-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">Minimum rating</span>
        <span className="text-xs font-medium text-muted-foreground">
          { minRating ? `${minRating} star${minRating > 1 ? 's' : ''} & up` : 'Any rating' }
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ () => onChange(DEFAULT_MIN_RATING) }
          className={ cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
            minRating === DEFAULT_MIN_RATING
              ? 'border-primary bg-primary/10 text-primary shadow-sm'
              : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-muted/70 hover:text-primary'
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
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
                isActive
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-muted/70 hover:text-primary'
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
