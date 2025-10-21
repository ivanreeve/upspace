'use client';

import React from 'react';
import { Filter } from 'lucide-react';

import { MAX_AMENITIES } from './constants';

import { Button } from '@/components/ui/button';

type FilterActionsProps = {
  isExpanded: boolean;
  onToggle: () => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  canAddAmenities: boolean;
};

export function FilterActions({
  isExpanded,
  onToggle,
  hasActiveFilters,
  onClear,
  canAddAmenities,
}: FilterActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <FilterToggleButton isExpanded={ isExpanded } onToggle={ onToggle } />
        { hasActiveFilters && (
          <button
            onClick={ onClear }
            type="button"
            className="text-sm font-semibold text-[#0f5a62] hover:underline"
          >
            Clear all filters
          </button>
        ) }
      </div>

      { !canAddAmenities && (
        <p className="text-xs font-medium text-muted-foreground">
          You can apply up to { MAX_AMENITIES } amenities.
        </p>
      ) }
    </div>
  );
}

type FilterToggleButtonProps = {
  isExpanded: boolean;
  onToggle: () => void;
};

function FilterToggleButton({
  isExpanded,
  onToggle,
}: FilterToggleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={ onToggle }
      className="inline-flex items-center gap-2 rounded-full border-[#0f5a62]/40 bg-transparent px-3 py-2 text-sm font-semibold text-[#0f5a62] hover:bg-secondary/20"
    >
      <Filter className="size-4" />
      <span>{ isExpanded ? 'Hide filters' : 'Show filters' }</span>
    </Button>
  );
}
