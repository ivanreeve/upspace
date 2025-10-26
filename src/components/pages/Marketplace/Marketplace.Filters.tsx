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
  onSearch: () => void;
};

export default function MarketplaceFilters({
  q,
  amenities,
  priceRange,
  minRating,
  onChange,
  onSearch,
}: FiltersProps) {
  const [draftAmenity, setDraftAmenity] = React.useState('');
  const [isFilterModalOpen, setFilterModalOpen] = React.useState(false);
  const [isAmenitiesModalOpen, setAmenitiesModalOpen] = React.useState(false);

  const canAddAmenities = amenities.length < MAX_AMENITIES;
  const hasActiveFilters =
    q.trim().length > 0 ||
    amenities.length > 0 ||
    minRating !== DEFAULT_MIN_RATING ||
    priceRange[0] !== DEFAULT_FILTER_STATE.priceRange[0] ||
    priceRange[1] !== DEFAULT_FILTER_STATE.priceRange[1];

  const formatCurrency = React.useCallback(
    (value: number) => `₱${value.toLocaleString('en-PH')}`,
    []
  );

  const updateFilters = React.useCallback((next: Partial<MarketplaceFilterState>) => {
    onChange({
      q,
      amenities,
      priceRange,
      minRating,
      ...next,
    });
  }, [amenities, minRating, onChange, priceRange, q]);

  const addAmenity = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned || !canAddAmenities) return false;
    const set = new Set(amenities.map((s) => s.trim()));
    if (!set.has(cleaned)) {
      updateFilters({ amenities: [...amenities, cleaned], });
      return true;
    }
    return false;
  };

  const removeAmenity = (name: string) => {
    updateFilters({ amenities: amenities.filter((a) => a !== name), });
  };

  const clearFilters = () => {
    setDraftAmenity('');
    setFilterModalOpen(false);
    setAmenitiesModalOpen(false);
    onChange({
      ...DEFAULT_FILTER_STATE,
      amenities: [],
      priceRange: [...DEFAULT_FILTER_STATE.priceRange] as [number, number],
    });
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
    } else if (e.key === 'Backspace' && !draftAmenity && amenities.length) {
      removeAmenity(amenities[amenities.length - 1]);
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

    const nextRating = minRating === rating ? DEFAULT_MIN_RATING : rating;
    updateFilters({ minRating: nextRating, });
  };

  return (
    <section className="rounded-3xl border border-border/40 bg-background/90 px-6 py-6 shadow-sm">
      <form
        className="flex flex-col gap-4 w-full"
        onSubmit={ (e) => { e.preventDefault(); onSearch(); } }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-border/50 bg-transparent px-4 py-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-0">
            <Search className="size-5 text-foreground/80" />
            <Input
              value={ q }
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
            onApply={ onSearch }
            modalContent={ (
              <div className="flex flex-col gap-5">
                <PriceRangeCard
                  priceRange={ priceRange }
                  formatCurrency={ formatCurrency }
                  onChange={ handlePriceRangeChange }
                />
                <RatingCard
                  minRating={ minRating }
                  onChange={ handleRatingChange }
                />
              </div>
            ) }
          />
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <AmenityControls
              amenities={ amenities }
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
        amenities={ amenities }
        canAddAmenities={ canAddAmenities }
        draftAmenity={ draftAmenity }
        remaining={ Math.max(0, MAX_AMENITIES - amenities.length) }
        onDraftChange={ (value) => setDraftAmenity(value) }
        onDraftKeyDown={ onAmenityKeyDown }
        onCommitAmenity={ commitAmenity }
        onRemoveAmenity={ removeAmenity }
        onClearAmenities={ clearAmenities }
      />
    </section>
  );
}
