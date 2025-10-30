'use client';

import React from 'react';
import { Plus, Search } from 'lucide-react';

import {
  DEFAULT_FILTER_STATE,
  DEFAULT_MIN_RATING,
  MAX_AMENITIES,
  type MarketplaceFilterState
} from './filters/constants';
import { AmenityControls } from './filters/AmenityControls';
import { AmenityModal } from './filters/AmenityModal';
import { FilterActions } from './filters/FilterActions';
import { PriceRangeCard } from './filters/PriceRangeCard';
import { RatingCard } from './filters/RatingCard';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FiltersProps = MarketplaceFilterState & {
  onChange: (next: MarketplaceFilterState) => void;
  onSearch: (next?: MarketplaceFilterState) => void;
};

export default function MarketplaceFilters({
  q,
  amenities,
  priceRange,
  minRating,
  onChange,
  onSearch,
}: FiltersProps) {
  const normalizedQ = typeof q === 'string' ? q : '';
  const normalizedAmenities = React.useMemo(() => (
    Array.isArray(amenities) ? amenities : []
  ), [amenities]);
  const normalizedPriceRange = React.useMemo(() => {
    if (Array.isArray(priceRange) && priceRange.length === 2) {
      return priceRange as [number, number];
    }
    return [...DEFAULT_FILTER_STATE.priceRange] as [number, number];
  }, [priceRange]);
  const normalizedMinRating = typeof minRating === 'number' ? minRating : DEFAULT_MIN_RATING;

  const buildState = React.useCallback((): MarketplaceFilterState => ({
    q: normalizedQ,
    amenities: [...normalizedAmenities],
    priceRange: [...normalizedPriceRange] as [number, number],
    minRating: normalizedMinRating,
  }), [normalizedAmenities, normalizedMinRating, normalizedPriceRange, normalizedQ]);
  const [draftAmenity, setDraftAmenity] = React.useState('');
  const [isFilterModalOpen, setFilterModalOpen] = React.useState(false);
  const [isAmenitiesModalOpen, setAmenitiesModalOpen] = React.useState(false);

  const canAddAmenities = normalizedAmenities.length < MAX_AMENITIES;
  const hasActiveFilters =
    normalizedQ.trim().length > 0 ||
    normalizedAmenities.length > 0 ||
    normalizedMinRating !== DEFAULT_MIN_RATING ||
    normalizedPriceRange[0] !== DEFAULT_FILTER_STATE.priceRange[0] ||
    normalizedPriceRange[1] !== DEFAULT_FILTER_STATE.priceRange[1];

  const formatCurrency = React.useCallback(
    (value: number) => `₱${value.toLocaleString('en-PH')}`,
    []
  );

  const updateFilters = React.useCallback((next: Partial<MarketplaceFilterState>) => {
    onChange({
      ...buildState(),
      ...next,
    });
  }, [buildState, onChange]);

  const addAmenity = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned || !canAddAmenities) return false;
    const set = new Set(normalizedAmenities.map((s) => s.trim()));
    if (!set.has(cleaned)) {
      updateFilters({ amenities: [...normalizedAmenities, cleaned], });
      return true;
    }
    return false;
  };

  const removeAmenity = (name: string) => {
    updateFilters({ amenities: normalizedAmenities.filter((a) => a !== name), });
  };

  const clearFilters = () => {
    const resetState: MarketplaceFilterState = {
      ...DEFAULT_FILTER_STATE,
      amenities: [],
      priceRange: [...DEFAULT_FILTER_STATE.priceRange] as [number, number],
    };

    setDraftAmenity('');
    setFilterModalOpen(false);
    setAmenitiesModalOpen(false);
    onChange(resetState);
    onSearch(resetState);
  };

  const clearAmenities = () => {
    setDraftAmenity('');
    updateFilters({ amenities: [], });
  };

  const commitAmenity = () => {
    const added = addAmenity(draftAmenity);
    if (added) {
      setDraftAmenity('');
    }
  };

  const onAmenityKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitAmenity();
    } else if (e.key === 'Backspace' && !draftAmenity && normalizedAmenities.length) {
      removeAmenity(normalizedAmenities[normalizedAmenities.length - 1]);
    }
  };

  const handlePriceRangeChange = (value: number[]) => {
    if (value.length !== 2) return;
    updateFilters({ priceRange: [value[0], value[1]] as [number, number], });
  };

  const handleRatingChange = (rating: number) => {
    if (rating === DEFAULT_MIN_RATING) {
      updateFilters({ minRating: DEFAULT_MIN_RATING, });
      return;
    }

    const nextRating = normalizedMinRating === rating ? DEFAULT_MIN_RATING : rating;
    updateFilters({ minRating: nextRating, });
  };

  return (
    <section className="rounded-3xl border border-border/40 bg-background/90 px-6 py-6 shadow-sm">
      <form
        className="flex flex-col gap-4 w-full"
        onSubmit={ (e) => {
          e.preventDefault();
          onSearch(buildState());
        } }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-border/50 bg-transparent px-4 py-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-0">
            <Search className="size-5 text-foreground/80" />
            <Input
              value={ normalizedQ }
              onChange={ (e) => updateFilters({ q: e.target.value, }) }
              placeholder="Find your perfect coworking space..."
              className="min-w-[160px] flex-1 border-none bg-transparent px-0 py-0 text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <Button
            type="submit"
            className="h-12 rounded-xl bg-[#0f5a62] px-8 text-base font-semibold shadow-sm hover:bg-[#0f5a62]/90"
          >
            Search
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-border/40 pt-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <FilterActions
            hasActiveFilters={ hasActiveFilters }
            onClear={ clearFilters }
            canAddAmenities={ canAddAmenities }
            isModalOpen={ isFilterModalOpen }
            onModalOpenChange={ setFilterModalOpen }
            onApply={ () => onSearch(buildState()) }
            modalContent={ (
              <div className="flex flex-col gap-5">
                <PriceRangeCard
                  priceRange={ normalizedPriceRange }
                  formatCurrency={ formatCurrency }
                  onChange={ handlePriceRangeChange }
                />
                <RatingCard
                  minRating={ normalizedMinRating }
                  onChange={ handleRatingChange }
                />
              </div>
            ) }
          />
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <AmenityControls
              amenities={ normalizedAmenities }
              canAddAmenities={ canAddAmenities }
              draftAmenity={ draftAmenity }
              onDraftChange={ (value) => setDraftAmenity(value) }
              onDraftKeyDown={ onAmenityKeyDown }
              onCommitAmenity={ commitAmenity }
              onRemoveAmenity={ removeAmenity }
              placeholder="Add an amenity and press Enter"
              showInput={ false }
              readOnly
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full text-[#0f5a62] hover:bg-[#0f5a62]/10"
              onClick={ () => setAmenitiesModalOpen(true) }
            >
              <Plus className="size-4" />
              <span className="sr-only">Manage amenities</span>
            </Button>
          </div>
        </div>
      </div>
      <AmenityModal
        open={ isAmenitiesModalOpen }
        onOpenChange={ (open) => {
          setAmenitiesModalOpen(open);
          if (!open) {
            setDraftAmenity('');
          }
        } }
        amenities={ normalizedAmenities }
        canAddAmenities={ canAddAmenities }
        draftAmenity={ draftAmenity }
        remaining={ Math.max(0, MAX_AMENITIES - normalizedAmenities.length) }
        onDraftChange={ (value) => setDraftAmenity(value) }
        onDraftKeyDown={ onAmenityKeyDown }
        onCommitAmenity={ commitAmenity }
        onRemoveAmenity={ removeAmenity }
        onClearAmenities={ clearAmenities }
      />
    </section>
  );
}
