'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FiLogOut, FiSearch, FiSliders } from 'react-icons/fi';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import { listSpaces } from '@/lib/api/spaces';
import { useSession } from '@/components/auth/SessionProvider';
import BackToTopButton from '@/components/ui/back-to-top';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import {
  fetchPhilippineBarangaysByCity,
  fetchPhilippineCitiesByRegion,
  fetchPhilippineRegions,
  type PhilippineBarangayOption,
  type PhilippineCityOption,
  type PhilippineRegionOption
} from '@/lib/philippines-addresses/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

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
  const hasError = Boolean(error);

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
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <SidebarProvider className="bg-background">
      <FiltersSidebar
        value={ draftFilters }
        onChange={ handleDraftChange }
        onApply={ applyFilters }
        onReset={ resetFilters }
        hasChanges={ draftHasChanges }
        priceBounds={ [PRICE_MIN, PRICE_MAX] }
        activeFiltersCount={ activeFilters.length }
      />

      <SidebarInset className="bg-background">
        <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SidebarTrigger className="h-9 w-9" />
                <span className="hidden md:inline">Filters</span>
              </div>
              <form
                onSubmit={ handleSearchSubmit }
                className="flex w-full flex-1 flex-col gap-3 rounded-md shadow-sm md:flex-row md:items-center"
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

            { hasError ? (
              <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
                <MarketplaceErrorState />
              </div>
            ) : (
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
            ) }
          </div>

          <BackToTopButton />
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}

type FiltersSidebarProps = {
  value: FiltersState;
  onChange: <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
  onApply: () => void;
  onReset: () => void;
  hasChanges: boolean;
  priceBounds: [number, number];
  activeFiltersCount: number;
};

function FiltersSidebar({
  value,
  onChange,
  onApply,
  onReset,
  hasChanges,
  priceBounds,
  activeFiltersCount,
}: FiltersSidebarProps) {
  const {
    isMobile,
    setOpenMobile,
  } = useSidebar();
  const {
    session,
    isLoading: isSessionLoading,
  } = useSession();
  const router = useRouter();
  const supabase = React.useMemo(() => getSupabaseBrowserClient(), []);

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  const handleApply = React.useCallback(() => {
    onApply();
    closeMobileSidebar();
  }, [closeMobileSidebar, onApply]);

  const handleReset = React.useCallback(() => {
    onReset();
    closeMobileSidebar();
  }, [closeMobileSidebar, onReset]);

  const avatarUrl = session?.user?.user_metadata?.avatar_url
    ?? session?.user?.user_metadata?.picture
    ?? null;
  const fallbackLabel =
    session?.user?.user_metadata?.full_name?.slice(0, 2)?.toUpperCase()
    ?? session?.user?.email?.slice(0, 2)?.toUpperCase()
    ?? 'US';
  const displayName =
    session?.user?.user_metadata?.full_name
    ?? session?.user?.user_metadata?.preferred_username
    ?? session?.user?.email
    ?? 'Guest';

  const handleLogout = React.useCallback(async () => {
    const { error, } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase sign-out failed', error);
      return;
    }
    router.refresh();
    closeMobileSidebar();
  }, [closeMobileSidebar, router, supabase]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground">
            <FiSliders aria-hidden="true" className="size-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold leading-tight text-sidebar-foreground">
              Advanced Filters
            </span>
            <span className="text-xs leading-tight text-sidebar-foreground/70">
              Collapse to icons or open on mobile.
            </span>
          </div>
          { activeFiltersCount > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              { activeFiltersCount } active
            </Badge>
          ) }
        </div>
      </SidebarHeader>
      <SidebarContent className="space-y-4 px-2 pb-4">
        <SidebarGroup>
          <SidebarGroupLabel>Marketplace filters</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
            <FiltersForm
              value={ value }
              onChange={ onChange }
              onApply={ handleApply }
              onReset={ handleReset }
              hasChanges={ hasChanges }
              priceBounds={ priceBounds }
            />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Quick settings</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-3">
            <div className="group-data-[collapsible=icon]:hidden">
              <ThemeSwitcher className="w-full" />
            </div>
            <SidebarMenu>
              { session && !isSessionLoading ? (
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        variant="outline"
                        size="lg"
                        tooltip={ displayName }
                        className="justify-start"
                      >
                        <Avatar className="size-8">
                          { avatarUrl ? (
                            <AvatarImage src={ avatarUrl } alt="User avatar" />
                          ) : (
                            <AvatarFallback>{ fallbackLabel }</AvatarFallback>
                          ) }
                        </Avatar>
                        <span className="truncate">{ displayName }</span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-[220px]">
                      <DropdownMenuItem
                        className="flex items-center gap-2"
                        onSelect={ (event) => {
                          event.preventDefault();
                          handleLogout();
                        } }
                      >
                        <FiLogOut className="size-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    variant="outline"
                    size="lg"
                    tooltip="Sign in"
                    className="justify-center"
                  >
                    <a href="/onboarding">Sign in</a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) }
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
        <p className="text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
          Press Ctrl+B (Cmd+B on Mac) to collapse the sidebar.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
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

      <Separator />

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-filters">
          <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />

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
