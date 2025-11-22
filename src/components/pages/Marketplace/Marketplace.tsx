'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiMapPin, FiSearch, FiSliders } from 'react-icons/fi';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';

import { listSpaces } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  fetchPhilippineBarangaysByCity,
  fetchPhilippineCitiesByRegion,
  fetchPhilippineRegions,
  type PhilippineBarangayOption,
  type PhilippineCityOption,
  type PhilippineRegionOption
} from '@/lib/philippines-addresses/client';

const PRICE_MIN = 200;
const PRICE_MAX = 5000;

type FiltersState = {
  q: string;
  region: string;
  city: string;
  barangay: string;
  available_from: string;
  available_to: string;
  priceRange: [number, number];
};

const DEFAULT_FILTERS: FiltersState = {
  q: '',
  region: '',
  city: '',
  barangay: '',
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

  const spaces = React.useMemo(() => data?.data ?? [], [data]);
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
    <div className="bg-background">
      <section className="px-4 py-10 sm:px-6 lg:px-10 max-w-[1400px] mx-auto">
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <Card className="sticky top-6 h-full border-border/70 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="space-y-1">
                  <CardTitle>Advanced Filters</CardTitle>
                  <CardDescription>
                    Narrow spaces by exact location, availability window, and price range.
                  </CardDescription>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <FiltersForm
                  value={ draftFilters }
                  onChange={ handleDraftChange }
                  onApply={ applyFilters }
                  onReset={ resetFilters }
                  hasChanges={ draftHasChanges }
                  priceBounds={ [PRICE_MIN, PRICE_MAX] }
                />
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-6">
            <form
              onSubmit={ handleSearchSubmit }
              className="flex flex-col gap-3 rounded-md shadow-sm md:flex-row md:items-center"
            >
              <div className="flex flex-1 items-center gap-3 rounded-xl border bg-background shadow-sm">
                <FiSearch aria-hidden="true" className="size-5 text-muted-foreground" />
                <Input
                  value={ searchValue }
                  onChange={ (event) => setSearchValue(event.target.value) }
                  placeholder="Search by space name, neighborhood, or keyword"
                  aria-label="Search spaces"
                  className="border-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                />
                <Button type="submit" className="w-full rounded-xl md:w-auto">
                  Search marketplace
                </Button>
              </div>
            </form>
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

const dedupeAddressOptions = <T extends { code: string; name: string }>(options: readonly T[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.code)) {
      return false;
    }
    seen.add(option.code);
    return true;
  });
};

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
  const [regionCode, setRegionCode] = React.useState<string | null>(null);
  const [cityCode, setCityCode] = React.useState<string | null>(null);
  const [barangayCode, setBarangayCode] = React.useState<string | null>(null);

  const {
    data: regionOptionsData = [],
    isLoading: isRegionsLoading,
    isError: isRegionsError,
  } = useQuery<PhilippineRegionOption[]>({
    queryKey: ['philippines', 'regions'],
    queryFn: fetchPhilippineRegions,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const regionOptions = React.useMemo(
    () => dedupeAddressOptions(regionOptionsData),
    [regionOptionsData]
  );

  const {
    data: cityOptionsData = [],
    isLoading: isCitiesLoading,
    isError: isCitiesError,
  } = useQuery<PhilippineCityOption[]>({
    queryKey: ['philippines', 'cities', regionCode],
    queryFn: () => {
      if (!regionCode) {
        return Promise.resolve<PhilippineCityOption[]>([]);
      }
      return fetchPhilippineCitiesByRegion(regionCode);
    },
    enabled: Boolean(regionCode),
    staleTime: 1000 * 60 * 60 * 12,
  });

  const cityOptions = React.useMemo(
    () => dedupeAddressOptions(cityOptionsData),
    [cityOptionsData]
  );

  const {
    data: barangayOptionsData = [],
    isLoading: isBarangaysLoading,
    isError: isBarangaysError,
  } = useQuery<PhilippineBarangayOption[]>({
    queryKey: ['philippines', 'barangays', cityCode],
    queryFn: () => {
      if (!cityCode) {
        return Promise.resolve<PhilippineBarangayOption[]>([]);
      }
      return fetchPhilippineBarangaysByCity(cityCode);
    },
    enabled: Boolean(cityCode),
    staleTime: 1000 * 60 * 5,
  });

  const barangayOptions = React.useMemo(
    () => dedupeAddressOptions(barangayOptionsData),
    [barangayOptionsData]
  );

  React.useEffect(() => {
    if (!value.region) {
      setRegionCode(null);
      return;
    }
    const match = regionOptions.find((region) => region.name === value.region);
    setRegionCode(match?.code ?? null);
  }, [regionOptions, value.region]);

  React.useEffect(() => {
    if (!value.city) {
      setCityCode(null);
      return;
    }
    const match = cityOptions.find((city) => city.name === value.city);
    setCityCode(match?.code ?? null);
  }, [cityOptions, value.city]);

  React.useEffect(() => {
    if (!value.barangay) {
      setBarangayCode(null);
      return;
    }
    const match = barangayOptions.find((barangay) => barangay.name === value.barangay);
    setBarangayCode(match?.code ?? null);
  }, [barangayOptions, value.barangay]);

  const [minPrice, maxPrice] = value.priceRange;

  const handleRegionSelect = (code: string | null) => {
    if (!code) {
      setRegionCode(null);
      onChange('region', '');
      setCityCode(null);
      onChange('city', '');
      setBarangayCode(null);
      onChange('barangay', '');
      return;
    }
    setRegionCode(code);
    const selected = regionOptions.find((region) => region.code === code);
    onChange('region', selected?.name ?? '');
    setCityCode(null);
    onChange('city', '');
    setBarangayCode(null);
    onChange('barangay', '');
  };

  const handleCitySelect = (code: string | null) => {
    if (!code) {
      setCityCode(null);
      onChange('city', '');
      setBarangayCode(null);
      onChange('barangay', '');
      return;
    }
    setCityCode(code);
    const selected = cityOptions.find((city) => city.code === code);
    onChange('city', selected?.name ?? '');
    setBarangayCode(null);
    onChange('barangay', '');
  };

  const handleBarangaySelect = (code: string | null) => {
    if (!code) {
      setBarangayCode(null);
      onChange('barangay', '');
      return;
    }
    setBarangayCode(code);
    const selected = barangayOptions.find((barangay) => barangay.code === code);
    onChange('barangay', selected?.name ?? '');
  };

  return (
    <form
      onSubmit={ (event) => {
        event.preventDefault();
        onApply();
      } }
      className="flex flex-col gap-5"
    >
      <Accordion type="single" collapsible defaultValue="advanced-filters" className="w-full">
        <AccordionItem value="advanced-filters">
          <AccordionTrigger className="text-base font-semibold">
            Advanced Filters
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="region-select">Region</Label>
              <Select
                value={ regionCode ?? undefined }
                onValueChange={ (next) => {
                  if (next === '__clear-region') {
                    handleRegionSelect(null);
                    return;
                  }
                  handleRegionSelect(next);
                } }
                disabled={ isRegionsLoading }
              >
                <SelectTrigger id="region-select" aria-label="Region" className="w-full">
                  <SelectValue
                    placeholder={
                      isRegionsError
                        ? 'Regions unavailable'
                        : isRegionsLoading
                          ? 'Loading regions...'
                          : 'Select region'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  { regionCode && (
                    <SelectItem value="__clear-region" className="text-destructive">
                      Clear selection
                    </SelectItem>
                  ) }
                  { isRegionsLoading && <SelectItem value="regions-loading" disabled>Loading regions…</SelectItem> }
                  { isRegionsError && <SelectItem value="regions-error" disabled>Unable to load regions</SelectItem> }
                  { !isRegionsLoading && !isRegionsError && regionOptions.map((region) => (
                    <SelectItem key={ region.code } value={ region.code }>
                      { region.name }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city-select">City</Label>
              <Select
                value={ cityCode ?? undefined }
                onValueChange={ (next) => {
                  if (next === '__clear-city') {
                    handleCitySelect(null);
                    return;
                  }
                  handleCitySelect(next);
                } }
                disabled={ !regionCode || isCitiesLoading }
              >
                <SelectTrigger id="city-select" aria-label="City" className="w-full">
                  <SelectValue
                    placeholder={
                      !regionCode
                        ? 'Select a region first'
                        : isCitiesError
                          ? 'Cities unavailable'
                          : isCitiesLoading
                            ? 'Loading cities...'
                            : 'Select city'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  { cityCode && (
                    <SelectItem value="__clear-city" className="text-destructive">
                      Clear selection
                    </SelectItem>
                  ) }
                  { isCitiesLoading && <SelectItem value="cities-loading" disabled>Loading cities…</SelectItem> }
                  { isCitiesError && <SelectItem value="cities-error" disabled>Unable to load cities</SelectItem> }
                  { !isCitiesLoading && !isCitiesError && cityOptions.map((city) => (
                    <SelectItem key={ city.code } value={ city.code }>
                      { city.name }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="barangay-select">Barangay</Label>
              <Select
                value={ barangayCode ?? undefined }
                onValueChange={ (next) => {
                  if (next === '__clear-barangay') {
                    handleBarangaySelect(null);
                    return;
                  }
                  handleBarangaySelect(next);
                } }
                disabled={ !cityCode || isBarangaysLoading }
              >
                <SelectTrigger id="barangay-select" aria-label="Barangay" className="w-full">
                  <SelectValue
                    placeholder={
                      !cityCode
                        ? 'Select a city first'
                        : isBarangaysError
                          ? 'Barangays unavailable'
                          : isBarangaysLoading
                            ? 'Loading barangays...'
                            : 'Select barangay'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  { barangayCode && (
                    <SelectItem value="__clear-barangay" className="text-destructive">
                      Clear selection
                    </SelectItem>
                  ) }
                  { isBarangaysLoading && <SelectItem value="barangays-loading" disabled>Loading barangays…</SelectItem> }
                  { isBarangaysError && <SelectItem value="barangays-error" disabled>Unable to load barangays</SelectItem> }
                  { !isBarangaysLoading && !isBarangaysError && barangayOptions.map((barangay) => (
                    <SelectItem key={ barangay.code } value={ barangay.code }>
                      { barangay.name }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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
