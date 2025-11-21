'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSearch, FiSliders } from 'react-icons/fi';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';

import { listSpaces } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

const PRICE_MIN = 200;
const PRICE_MAX = 5000;

type FiltersState = {
  q: string;
  region: string;
  city: string;
  barangay: string;
  street: string;
  available_from: string;
  available_to: string;
  priceRange: [number, number];
};

const DEFAULT_FILTERS: FiltersState = {
  q: '',
  region: '',
  city: '',
  barangay: '',
  street: '',
  available_from: '',
  available_to: '',
  priceRange: [PRICE_MIN, PRICE_MAX],
};

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const areFiltersEqual = (a: FiltersState, b: FiltersState) =>
  a.q === b.q &&
  a.region === b.region &&
  a.city === b.city &&
  a.barangay === b.barangay &&
  a.street === b.street &&
  a.available_from === b.available_from &&
  a.available_to === b.available_to &&
  a.priceRange[0] === b.priceRange[0] &&
  a.priceRange[1] === b.priceRange[1];

const buildActiveFilters = (filters: FiltersState) => {
  const chips: string[] = [];
  if (filters.q.trim()) chips.push(`Search · ${filters.q.trim()}`);
  if (filters.region.trim()) chips.push(`Region · ${filters.region.trim()}`);
  if (filters.city.trim()) chips.push(`City · ${filters.city.trim()}`);
  if (filters.barangay.trim()) chips.push(`Barangay · ${filters.barangay.trim()}`);
  if (filters.street.trim()) chips.push(`Street · ${filters.street.trim()}`);
  if (filters.available_from || filters.available_to) {
    chips.push(`Hours · ${filters.available_from || 'Any'} – ${filters.available_to || 'Any'}`);
  }
  if (filters.priceRange[0] > PRICE_MIN || filters.priceRange[1] < PRICE_MAX) {
    chips.push(
      `₱${filters.priceRange[0].toLocaleString()} – ₱${filters.priceRange[1].toLocaleString()}`
    );
  }
  return chips;
};

const buildQueryParams = (filters: FiltersState) => ({
  limit: 24,
  q: filters.q.trim() || undefined,
  region: filters.region.trim() || undefined,
  city: filters.city.trim() || undefined,
  barangay: filters.barangay.trim() || undefined,
  street: filters.street.trim() || undefined,
  available_from: filters.available_from || undefined,
  available_to: filters.available_to || undefined,
  min_rate_price: filters.priceRange[0] > PRICE_MIN ? filters.priceRange[0] : undefined,
  max_rate_price: filters.priceRange[1] < PRICE_MAX ? filters.priceRange[1] : undefined,
  include_pending: true,
});

export default function Marketplace() {
  const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [searchValue, setSearchValue] = React.useState('');
  const [isSheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    setSearchValue(filters.q);
    setDraftFilters(filters);
  }, [filters]);

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['marketplace-spaces', filters],
    queryFn: async () => listSpaces(buildQueryParams(filters)),
    keepPreviousData: true,
  });

  const spaces = data?.data ?? [];
  const activeFilters = buildActiveFilters(filters);
  const hasActiveFilters = activeFilters.length > 0;
  const draftHasChanges = !areFiltersEqual(draftFilters, filters);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((prev) => ({
      ...prev,
      q: searchValue.trim(),
    }));
  };

  const handleDraftChange = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setSheetOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setSheetOpen(false);
  };

  return (
    <div className="bg-muted/20">
      <section className="bg-gradient-to-br from-primary via-primary to-secondary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
              UpSpace marketplace
            </p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Discover trusted coworking, studio, and event spaces
            </h1>
            <p className="max-w-2xl text-base text-primary-foreground/80">
              Browse live and pending partner spaces while we expand our catalog. Search by
              neighborhood, filter by availability, and compare rates in one view.
            </p>
          </div>

          <form
            onSubmit={ handleSearchSubmit }
            className="flex flex-col gap-3 rounded-2xl bg-white/10 p-4 shadow-2xl shadow-black/10 backdrop-blur md:flex-row md:items-center"
          >
            <div className="flex flex-1 items-center gap-3 rounded-xl bg-white/90 px-4 py-2 text-foreground">
              <FiSearch aria-hidden="true" className="size-5 text-muted-foreground" />
              <Input
                value={ searchValue }
                onChange={ (event) => setSearchValue(event.target.value) }
                placeholder="Search by space name, neighborhood, or keyword"
                aria-label="Search spaces"
                className="border-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 md:w-auto"
            >
              Search marketplace
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-6 rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Filters</p>
                <h2 className="text-lg font-semibold">Advanced options</h2>
                <p className="text-sm text-muted-foreground">
                  Narrow spaces by exact location, availability window, and price range.
                </p>
              </div>
              <Separator className="my-4" />
              <FiltersForm
                value={ draftFilters }
                onChange={ handleDraftChange }
                onApply={ applyFilters }
                onReset={ resetFilters }
                hasChanges={ draftHasChanges }
                priceBounds={ [PRICE_MIN, PRICE_MAX] }
              />
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Results
                </p>
                <h2 className="text-2xl font-semibold leading-tight">
                  { spaces.length } spaces loaded
                </h2>
                <p className="text-sm text-muted-foreground">
                  Showing approved spaces plus pending submissions (testing mode).
                </p>
              </div>

              <Sheet open={ isSheetOpen } onOpenChange={ setSheetOpen }>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="ml-auto inline-flex items-center gap-2 lg:hidden"
                  >
                    <FiSliders aria-hidden="true" className="size-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Advanced filters</SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      Tailor results by exact address, hours, and rate range.
                    </p>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-4 pb-6">
                    <FiltersForm
                      value={ draftFilters }
                      onChange={ handleDraftChange }
                      onApply={ applyFilters }
                      onReset={ resetFilters }
                      hasChanges={ draftHasChanges }
                      priceBounds={ [PRICE_MIN, PRICE_MAX] }
                    />
                  </div>
                  <SheetFooter>
                    <p className="text-xs text-muted-foreground">
                      Filters apply immediately after tapping &ldquo;Apply filters.&rdquo;
                    </p>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>

            { hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                { activeFilters.map((label) => (
                  <Badge key={ label } variant="secondary" className="bg-secondary/20 text-secondary-foreground">
                    { label }
                  </Badge>
                )) }
                <Button variant="link" size="sm" className="text-primary" onClick={ resetFilters }>
                  Reset filters
                </Button>
              </div>
            ) }

            { error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load spaces. Please try again in a moment.
              </div>
            ) }

            <div className="space-y-3">
              { isLoading ? (
                <SkeletonGrid />
              ) : (
                <CardsGrid items={ spaces } />
              ) }
              { isFetching && !isLoading && (
                <p className="text-xs text-muted-foreground">Refreshing latest availability…</p>
              ) }
            </div>
          </div>
        </div>

        <BackToTopButton />
      </section>
    </div>
  );
}

type FiltersFormProps = {
  value: FiltersState;
  onChange: <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
  onApply: () => void;
  onReset: () => void;
  hasChanges: boolean;
  priceBounds: [number, number];
};

function FiltersForm({
  value,
  onChange,
  onApply,
  onReset,
  hasChanges,
  priceBounds,
}: FiltersFormProps) {
  const [minPrice, maxPrice] = value.priceRange;
  return (
    <form
      onSubmit={ (event) => {
        event.preventDefault();
        onApply();
      } }
      className="flex flex-col gap-5"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="region-input">Region</Label>
          <Input
            id="region-input"
            placeholder="e.g. Metro Manila"
            value={ value.region }
            onChange={ (event) => onChange('region', event.target.value) }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city-input">City</Label>
          <Input
            id="city-input"
            placeholder="e.g. Makati"
            value={ value.city }
            onChange={ (event) => onChange('city', event.target.value) }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="barangay-input">Barangay</Label>
          <Input
            id="barangay-input"
            placeholder="e.g. San Lorenzo"
            value={ value.barangay }
            onChange={ (event) => onChange('barangay', event.target.value) }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="street-input">Street</Label>
          <Input
            id="street-input"
            placeholder="Street or business park"
            value={ value.street }
            onChange={ (event) => onChange('street', event.target.value) }
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Availability window (HH:MM)</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="time"
            step={ 900 }
            value={ value.available_from }
            onChange={ (event) => onChange('available_from', event.target.value) }
            aria-label="Opens at"
          />
          <Input
            type="time"
            step={ 900 }
            value={ value.available_to }
            onChange={ (event) => onChange('available_to', event.target.value) }
            aria-label="Closes at"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Filter spaces that operate during your preferred window (24-hour format).
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-semibold">
          <Label htmlFor="price-range">Price range (PHP)</Label>
          <span>{ `${peso.format(minPrice)} – ${peso.format(maxPrice)}` }</span>
        </div>
        <Slider
          id="price-range"
          step={ 50 }
          min={ priceBounds[0] }
          max={ priceBounds[1] }
          value={ value.priceRange }
          onValueChange={ (next) => {
            if (Array.isArray(next) && next.length === 2) {
              onChange('priceRange', [next[0], next[1]]);
            }
          } }
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll match areas whose base hourly rates fall inside this bracket.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-dashed pt-4 sm:flex-row">
        <Button type="submit" className="w-full sm:flex-1" disabled={ !hasChanges }>
          Apply filters
        </Button>
        <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={ onReset }>
          Reset
        </Button>
      </div>
    </form>
  );
}
