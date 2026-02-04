'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
FiLoader,
FiList,
FiSearch,
FiX
} from 'react-icons/fi';
import { CgOptions } from 'react-icons/cg';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import {
  listSpaces,
  suggestSpaces,
  type Space,
  type SpaceSuggestion
} from '@/lib/api/spaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BackToTopButton from '@/components/ui/back-to-top';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { VoiceSearchButton } from '@/components/ui/voice-search-button';
import { VoiceSearchDialog } from '@/components/ui/voice-search-dialog';
import {
  fetchPhilippineBarangaysByCity,
  fetchPhilippineCitiesByRegion,
  fetchPhilippineRegions,
  type PhilippineBarangayOption,
  type PhilippineCityOption,
  type PhilippineRegionOption
} from '@/lib/philippines-addresses/client';
import { dedupeAddressOptions } from '@/lib/addresses';
import { BottomGradientOverlay } from '@/components/ui/bottom-gradient-overlay';
import { AMENITY_CATEGORY_DISPLAY_MAP } from '@/lib/amenity/amenity_category_display_map';
import { AMENITY_ICON_MAPPINGS } from '@/lib/amenity/amenity_icon_mappings';
import { useMarketplaceChromeSlot } from '@/components/pages/Marketplace/MarketplaceChromeProvider';
import { cn } from '@/lib/utils';

type FiltersState = {
  q: string;
  region: string;
  city: string;
  barangay: string;
  amenities: string[];
  amenitiesMode: 'all' | 'any';
  amenitiesNegate: boolean;
};

const DEFAULT_FILTERS: FiltersState = {
  q: '',
  region: '',
  city: '',
  barangay: '',
  amenities: [],
  amenitiesMode: 'any',
  amenitiesNegate: false,
};

const normalizeFilterValue = (value?: string) => (value ?? '').trim();
const normalizeAmenityValues = (amenities?: string[]) =>
  Array.from(
    new Set(
      (amenities ?? [])
        .map((value) => normalizeFilterValue(value))
        .filter(Boolean)
    )
  );
const areFiltersEqual = (a: FiltersState, b: FiltersState) => {
  if (
    a.q !== b.q ||
    a.region !== b.region ||
    a.city !== b.city ||
    a.barangay !== b.barangay ||
    a.amenitiesMode !== b.amenitiesMode ||
    a.amenitiesNegate !== b.amenitiesNegate
  ) {
    return false;
  }

  if (a.amenities.length !== b.amenities.length) return false;

  for (let index = 0; index < a.amenities.length; index += 1) {
    if (a.amenities[index] !== b.amenities[index]) {
      return false;
    }
  }

  return true;
};
const ORDERED_AMENITY_CATEGORIES = Object.keys(AMENITY_CATEGORY_DISPLAY_MAP);

const CURATED_HIGHLIGHT_LIMIT = 10;
const PAGINATED_PAGE_SIZE = 12;
const LIST_QUERY_LIMIT = PAGINATED_PAGE_SIZE + CURATED_HIGHLIGHT_LIMIT * 2;

const buildQueryParams = (filters: FiltersState) => {
  const amenities = normalizeAmenityValues(filters.amenities);
  const hasAmenities = amenities.length > 0;

  return {
    limit: LIST_QUERY_LIMIT,
    q: normalizeFilterValue(filters.q) || undefined,
    region: normalizeFilterValue(filters.region) || undefined,
    city: normalizeFilterValue(filters.city) || undefined,
    barangay: normalizeFilterValue(filters.barangay) || undefined,
    amenities: hasAmenities ? amenities : undefined,
    amenities_mode: hasAmenities ? filters.amenitiesMode : undefined,
    amenities_negate: hasAmenities ? filters.amenitiesNegate : undefined,
    include_pending: false,
  };
};

type LocationMatchResult = {
  region?: string;
  city?: string;
  barangay?: string;
};

type CityIndexEntry = {
  normalizedName: string;
  regionName: string;
  cityName: string;
  cityCode: string;
};

const LOCATION_PREPOSITION_REGEX = /\b(?:in|at|near)\s+(.+)$/i;
const LOCATION_BARANGAY_REGEX = /^(?:barangay|brgy)\b\.?\s*(.+)$/i;
const LOCATION_SPLIT_REGEX = /[,;]+/;
const LOCATION_DESCRIPTOR_REGEX =
  /\b(?:city|municipality|mun|municipal|province|metro|region|barangay|brgy)\b/gi;

const locationDataCache = {
  regions: null as PhilippineRegionOption[] | null,
  cities: new Map<string, PhilippineCityOption[]>(),
  barangays: new Map<string, PhilippineBarangayOption[]>(),
  cityIndex: null as CityIndexEntry[] | null,
};

const normalizeLocationName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(LOCATION_DESCRIPTOR_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const loadRegionsCached = async () => {
  if (!locationDataCache.regions) {
    locationDataCache.regions = await fetchPhilippineRegions();
  }

  return locationDataCache.regions;
};

const loadCitiesForRegionCached = async (regionCode: string) => {
  if (!locationDataCache.cities.has(regionCode)) {
    const cities = await fetchPhilippineCitiesByRegion(regionCode);
    locationDataCache.cities.set(regionCode, cities);
  }

  return locationDataCache.cities.get(regionCode)!;
};

const loadBarangaysForCityCached = async (cityCode: string) => {
  if (!locationDataCache.barangays.has(cityCode)) {
    const barangays = await fetchPhilippineBarangaysByCity(cityCode);
    locationDataCache.barangays.set(cityCode, barangays);
  }

  return locationDataCache.barangays.get(cityCode)!;
};

const ensureCityIndex = async (
  regions: PhilippineRegionOption[]
): Promise<CityIndexEntry[]> => {
  if (locationDataCache.cityIndex) {
    return locationDataCache.cityIndex;
  }

  const entries: CityIndexEntry[] = [];
  for (const region of regions) {
    const cities = dedupeAddressOptions(
      await loadCitiesForRegionCached(region.code)
    );

    for (const city of cities) {
      const normalized = normalizeLocationName(city.name);
      if (!normalized) continue;

      entries.push({
        cityCode: city.code,
        cityName: city.name,
        normalizedName: normalized,
        regionName: region.name,
      });
    }
  }

  locationDataCache.cityIndex = entries;
  return entries;
};

const findCityMatchFromIndex = (
  normalizedTarget: string,
  entries: CityIndexEntry[]
): CityIndexEntry | null => {
  if (!normalizedTarget) {
    return null;
  }

  for (const entry of entries) {
    if (
      entry.normalizedName === normalizedTarget ||
      entry.normalizedName.includes(normalizedTarget) ||
      normalizedTarget.includes(entry.normalizedName)
    ) {
      return entry;
    }
  }

  return null;
};

const findRegionMatchFromSegments = (
  segments: string[],
  regions: PhilippineRegionOption[]
): PhilippineRegionOption | null => {
  for (const segment of segments) {
    const normalizedSegment = normalizeLocationName(segment);
    if (!normalizedSegment) continue;

    for (const region of regions) {
      const normalizedRegion = normalizeLocationName(region.name);
      if (
        normalizedRegion === normalizedSegment ||
        normalizedRegion.includes(normalizedSegment) ||
        normalizedSegment.includes(normalizedRegion)
      ) {
        return region;
      }
    }
  }

  return null;
};

const findBarangayMatch = async (
  cityCode: string,
  candidate?: string
): Promise<PhilippineBarangayOption | null> => {
  if (!cityCode || !candidate) {
    return null;
  }

  const normalizedCandidate = normalizeLocationName(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  const barangays = dedupeAddressOptions(
    await loadBarangaysForCityCached(cityCode)
  );

  for (const barangay of barangays) {
    const normalizedBarangay = normalizeLocationName(barangay.name);
    if (
      normalizedBarangay === normalizedCandidate ||
      normalizedBarangay.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedBarangay)
    ) {
      return barangay;
    }
  }

  return null;
};

const resolveLocationFromQuery = async (
  query: string
): Promise<LocationMatchResult> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return {};
  }

  const locationCandidate =
    LOCATION_PREPOSITION_REGEX.exec(trimmed)?.[1] ?? trimmed;
  const rawSegments = locationCandidate
    .split(LOCATION_SPLIT_REGEX)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!rawSegments.length) {
    return {};
  }

  const locationSegments: string[] = [];
  let barangayCandidate: string | undefined;
  for (const segment of rawSegments) {
    const barangayMatch = segment.match(LOCATION_BARANGAY_REGEX);
    if (barangayMatch && barangayMatch[1]) {
      barangayCandidate = barangayMatch[1].trim();
      continue;
    }

    locationSegments.push(segment);
  }

  if (!locationSegments.length) {
    locationSegments.push(locationCandidate.trim());
  }

  const regions = await loadRegionsCached();
  const cityIndex = await ensureCityIndex(regions);

  let cityMatch: CityIndexEntry | null = null;

  for (const segment of locationSegments) {
    const normalizedSegment = normalizeLocationName(segment);
    cityMatch = findCityMatchFromIndex(normalizedSegment, cityIndex);
    if (cityMatch) {
      break;
    }
  }

  if (!cityMatch) {
    const normalizedFallback = normalizeLocationName(locationCandidate);
    cityMatch = findCityMatchFromIndex(normalizedFallback, cityIndex);
  }

  if (cityMatch) {
    const result: LocationMatchResult = {
      region: cityMatch.regionName,
      city: cityMatch.cityName,
    };

    const barangayMatch = await findBarangayMatch(
      cityMatch.cityCode,
      barangayCandidate
    );
    if (barangayMatch) {
      result.barangay = barangayMatch.name;
    }

    return result;
  }

  const regionMatch =
    findRegionMatchFromSegments(locationSegments, regions) ??
    findRegionMatchFromSegments([locationCandidate], regions);
  if (regionMatch) {
    return { region: regionMatch.name, };
  }

  return {};
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}

export default function Marketplace() {
  const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] =
    React.useState<FiltersState>(DEFAULT_FILTERS);
  const [searchValue, setSearchValue] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const applyFilters = React.useCallback((updates: Partial<FiltersState>) => {
    setPendingFilters((prev) => {
      const next: FiltersState = {
        ...prev,
        ...updates,
        q: normalizeFilterValue(updates.q ?? prev.q),
        region: normalizeFilterValue(updates.region ?? prev.region),
        city: normalizeFilterValue(updates.city ?? prev.city),
        barangay: normalizeFilterValue(updates.barangay ?? prev.barangay),
        amenities: normalizeAmenityValues(updates.amenities ?? prev.amenities),
        amenitiesMode: updates.amenitiesMode ?? prev.amenitiesMode,
        amenitiesNegate: updates.amenitiesNegate ?? prev.amenitiesNegate,
      };

      if (areFiltersEqual(prev, next)) {
        return prev;
      }

      return next;
    });
  }, []);

  React.useEffect(() => {
    setSearchValue(filters.q ?? '');
  }, [filters.q]);

  const openSearchModal = React.useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSearchOpenChange = React.useCallback(
    (open: boolean) => {
      setIsSearchOpen(open);
      if (!open) {
        setSearchValue(filters.q ?? '');
      }
    },
    [filters.q]
  );

  const handleSearchSubmit = React.useCallback(
    async (value?: string) => {
      const nextValue = typeof value === 'string' ? value : searchValue;
      const normalized = normalizeFilterValue(nextValue);
      let locationOverrides: LocationMatchResult = {};

      if (normalized) {
        try {
          locationOverrides = await resolveLocationFromQuery(normalized);
        } catch {
          // Location resolution failed, fall back to user-provided filters.
        }
      }

      const nextFilters: FiltersState = {
        ...pendingFilters,
        q: normalized,
        region: locationOverrides.region ?? pendingFilters.region,
        city: locationOverrides.city ?? pendingFilters.city,
        barangay: locationOverrides.barangay ?? pendingFilters.barangay,
      };

      if (locationOverrides.region) {
        nextFilters.city = locationOverrides.city ?? '';
        nextFilters.barangay = locationOverrides.barangay ?? '';
      }

      if (locationOverrides.city && !locationOverrides.barangay) {
        nextFilters.barangay = '';
      }

      setSearchValue(normalized);
      setPendingFilters((prev) =>
        areFiltersEqual(prev, nextFilters) ? prev : nextFilters
      );
      setFilters((prev) =>
        areFiltersEqual(prev, nextFilters) ? prev : nextFilters
      );
      setIsSearchOpen(false);
    },
    [pendingFilters, searchValue]
  );

  React.useEffect(() => {
    if (searchParams.get('search') !== '1') return;

    openSearchModal();

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('search');
    const searchString = nextParams.toString();
    const nextUrl = `${pathname}${searchString ? `?${searchString}` : ''}`;
    router.replace(nextUrl, { scroll: false, });
  }, [openSearchModal, pathname, router, searchParams]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const {
 data, isLoading, isFetching, error, refetch, 
} = useQuery({
    queryKey: ['marketplace-spaces', filters],
    queryFn: async () => listSpaces(buildQueryParams(filters)),
  });

  const spaces = React.useMemo(() => {
    const allSpaces = data?.data ?? [];
    return allSpaces.filter((space) => space.status === 'Live');
  }, [data]);
  const hasError = Boolean(error);
  const hasActiveSearch = Boolean(filters.q.trim());
  const hasLocationFilters = Boolean(
    filters.region || filters.city || filters.barangay
  );
  const hasAmenityFilters = filters.amenities.length > 0;
  const hasAnyFilters = hasLocationFilters || hasAmenityFilters;
  const pendingHasLocationFilters = Boolean(
    pendingFilters.region || pendingFilters.city || pendingFilters.barangay
  );
  const pendingHasAmenityFilters = pendingFilters.amenities.length > 0;
  const pendingHasAnyFilters =
    pendingHasLocationFilters || pendingHasAmenityFilters;
  const shouldShowResultsHeader = hasActiveSearch || hasAnyFilters;
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocOverflow = document.documentElement.style.overflow;

    if (hasError) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocOverflow;
    };
  }, [hasError]);

  const ratingSortedSpaces = React.useMemo(() => {
    return [...spaces].sort((a, b) => {
      const ratingA = a.average_rating ?? 0;
      const ratingB = b.average_rating ?? 0;
      const ratingDiff = ratingB - ratingA;

      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      return (b.total_reviews ?? 0) - (a.total_reviews ?? 0);
    });
  }, [spaces]);

  const nearYouSortedSpaces = React.useMemo(() => {
    return [...spaces]
      .filter((space) => typeof space.distance_meters === 'number')
      .sort((a, b) => {
        const ratingDiff = (b.average_rating ?? 0) - (a.average_rating ?? 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        return (a.distance_meters ?? 0) - (b.distance_meters ?? 0);
      });
  }, [spaces]);

  const topRatedSpaces = ratingSortedSpaces.slice(0, CURATED_HIGHLIGHT_LIMIT);
  const nearYouSpaces = nearYouSortedSpaces.slice(0, CURATED_HIGHLIGHT_LIMIT);

  const curatedSpaceIds = React.useMemo(() => {
    const ids = new Set<string>();
    topRatedSpaces.forEach((space) => ids.add(space.space_id));
    nearYouSpaces.forEach((space) => ids.add(space.space_id));
    return ids;
  }, [topRatedSpaces, nearYouSpaces]);

  const restSpaces = React.useMemo(() => {
    return spaces.filter((space) => !curatedSpaceIds.has(space.space_id));
  }, [spaces, curatedSpaceIds]);

  const totalRestPages = Math.max(
    1,
    Math.ceil(restSpaces.length / PAGINATED_PAGE_SIZE)
  );

  React.useEffect(() => {
    if (currentPage > totalRestPages) {
      setCurrentPage(totalRestPages);
    }
  }, [currentPage, totalRestPages]);

  const paginatedRestSpaces = React.useMemo(() => {
    const startIndex = (currentPage - 1) * PAGINATED_PAGE_SIZE;
    return restSpaces.slice(startIndex, startIndex + PAGINATED_PAGE_SIZE);
  }, [restSpaces, currentPage]);

  const paginationRange = React.useMemo(() => {
    const maxButtons = 5;
    if (totalRestPages <= 1) {
      return [1];
    }

    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalRestPages, start + maxButtons - 1);

    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    const range: number[] = [];
    for (let page = start; page <= end; page += 1) {
      range.push(page);
    }

    return range;
  }, [currentPage, totalRestPages]);

  const shouldShowPagination = restSpaces.length > PAGINATED_PAGE_SIZE;

  const curatedCarousels =
    nearYouSpaces.length === 0 && topRatedSpaces.length === 0 ? null : (
      <div className="space-y-8">
        { nearYouSpaces.length > 0 && (
          <MarketplaceHighlightsSection
            title="Near You"
            items={ nearYouSpaces }
            emptyMessage="No nearby spaces yet. Try refining your region or city to surface curated matches."
          />
        ) }
        { topRatedSpaces.length > 0 && (
          <MarketplaceHighlightsSection
            title="Top Rated"
            items={ topRatedSpaces }
            emptyMessage="Highly rated workspaces are still coming. Check back in a moment for fresh listings."
          />
        ) }
      </div>
    );

  const searchResultsSection = (
    <div className="space-y-6">
      { shouldShowResultsHeader && (
        <h2 className="text-2xl font-semibold text-foreground">
          Search Results
        </h2>
      ) }
      { hasError ? (
        <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
          <MarketplaceErrorState
            onRetry={ () => {
              void refetch();
            } }
            isRetrying={ isFetching }
          />
        </div>
      ) : (
        <div className="space-y-3">
          { hasActiveSearch && (
            <p className="text-sm text-muted-foreground">
              Showing results for &quot;{ filters.q }&quot;
            </p>
          ) }
          <CardsGrid items={ paginatedRestSpaces } isLoading={ isLoading } />
          { shouldShowPagination && (
            <div className="flex flex-col items-stretch gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={ () => {
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                  } }
                  disabled={ currentPage === 1 }
                >
                  Previous
                </Button>
                <div className="flex flex-wrap items-center gap-1">
                  { paginationRange.map((page) => (
                    <Button
                      key={ page }
                      type="button"
                      variant={ page === currentPage ? 'secondary' : 'outline' }
                      size="sm"
                      onClick={ () => {
                        setCurrentPage(page);
                      } }
                    >
                      { page }
                    </Button>
                  )) }
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={ () => {
                    setCurrentPage((prev) =>
                      Math.min(totalRestPages, prev + 1)
                    );
                  } }
                  disabled={ currentPage === totalRestPages }
                >
                  Next
                </Button>
              </div>
              <span className="text-xs text-muted-foreground text-right">
                Page { currentPage } of { totalRestPages }
              </span>
            </div>
          ) }
          { isFetching && !isLoading && (
            <p className="text-xs text-muted-foreground">
              Refreshing latest availability…
            </p>
          ) }
        </div>
      ) }
    </div>
  );

  const content = (
    <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      { isLoading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <SkeletonGrid count={ 12 } />
        </div>
      ) : (
        <div className="space-y-10">
          { curatedCarousels }
          { searchResultsSection }
        </div>
      ) }

      <div className="hidden md:block">
        <BackToTopButton />
      </div>
      <BottomGradientOverlay />
    </section>
  );

  const searchDialog = React.useMemo(
    () => (
      <MarketplaceSearchDialog
        open={ isSearchOpen }
        onOpenChange={ handleSearchOpenChange }
        searchValue={ searchValue }
        onSearchChange={ setSearchValue }
        onSearchSubmit={ handleSearchSubmit }
        hasActiveSearch={ hasActiveSearch }
        hasAnyFilters={ pendingHasAnyFilters }
        filters={ pendingFilters }
        onFiltersApply={ applyFilters }
      />
    ),
    [
      applyFilters,
      handleSearchOpenChange,
      handleSearchSubmit,
      hasActiveSearch,
      isSearchOpen,
      pendingFilters,
      pendingHasAnyFilters,
      searchValue
    ]
  );

  useMarketplaceChromeSlot({
    dialogSlot: searchDialog,
    onSearchOpen: openSearchModal,
  });

  return content;
}

type MarketplaceSearchDialogProps = {
  open: boolean;
  searchValue: string;
  hasActiveSearch: boolean;
  hasAnyFilters: boolean;
  filters: FiltersState;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (value?: string) => Promise<void>;
  onFiltersApply: (updates: Partial<FiltersState>) => void;
};

function MarketplaceSearchDialog({
  open,
  onOpenChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  hasActiveSearch,
  hasAnyFilters,
  filters,
  onFiltersApply,
}: MarketplaceSearchDialogProps) {
  const trimmedValue = searchValue.trim();
  const debouncedQuery = useDebouncedValue(trimmedValue, 200);
  const isMobile = useIsMobile();
  const shouldFetchSuggestions = debouncedQuery.length >= 2;
  const [isFilterDialogOpen, setIsFilterDialogOpen] = React.useState(false);
  const searchDialogOpen = open && !isFilterDialogOpen;
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = React.useState(false);
  const router = useRouter();
  const handleVoiceSearchSubmit = React.useCallback(
    (value: string) => {
      onSearchChange(value);
      void onSearchSubmit(value);
      setIsVoiceSearchOpen(false);
    },
    [onSearchChange, onSearchSubmit]
  );

  React.useEffect(() => {
    if (!open) {
      setIsFilterDialogOpen(false);
    }
  }, [open]);

  const handleSearchDialogOpenChange = React.useCallback(
    (next: boolean) => {
      if (isFilterDialogOpen && !next) {
        setIsFilterDialogOpen(false);
      }

      onOpenChange(next);
    },
    [isFilterDialogOpen, onOpenChange]
  );

  const handleVoiceButtonClick = React.useCallback(() => {
    handleSearchDialogOpenChange(false);
    setIsVoiceSearchOpen(true);
  }, [handleSearchDialogOpenChange]);

  const {
    data: suggestionData,
    isFetching: isFetchingSuggestions,
    isError: isSuggestionError,
  } = useQuery({
    queryKey: ['space-suggestions', debouncedQuery],
    queryFn: ({ signal, }) =>
      suggestSpaces({
        q: debouncedQuery,
        limit: 8,
        include_pending: false,
        signal,
      }),
    enabled: shouldFetchSuggestions,
    staleTime: 30_000,
  });

  const suggestions: SpaceSuggestion[] = suggestionData?.suggestions ?? [];
  const suggestionStatusMessage = shouldFetchSuggestions
    ? `Showing ${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}.`
    : 'Type at least two characters to see suggestions.';
  const handleAmenityRemove = React.useCallback(
    (name: string) => {
      const next = filters.amenities.filter((value) => value !== name);
      onFiltersApply({
        amenities: next,
        amenitiesMode: next.length ? filters.amenitiesMode : 'any',
        amenitiesNegate: next.length ? filters.amenitiesNegate : false,
      });
    },
    [
      filters.amenities,
      filters.amenitiesMode,
      filters.amenitiesNegate,
      onFiltersApply
    ]
  );
  const handleSuggestionSelect = React.useCallback(
    (suggestion: SpaceSuggestion) => {
      onSearchChange(suggestion.name);
      void onSearchSubmit(suggestion.name);
      router.push(`/marketplace/${suggestion.space_id}`);
    },
    [onSearchChange, onSearchSubmit, router]
  );

  return (
    <>
      <CommandDialog
        open={ searchDialogOpen }
        onOpenChange={ handleSearchDialogOpenChange }
        title="Search spaces"
        description="Search the UpSpace marketplace"
        titleId="marketplace-search-dialog-title"
        descriptionId="marketplace-search-dialog-description"
        position="top"
        mobileFullScreen={ isMobile }
        fullWidth
      >
        <CommandInput
          value={ searchValue }
          onValueChange={ onSearchChange }
          placeholder="Search Spaces..."
          aria-label="Search spaces"
          onKeyDown={ (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void onSearchSubmit();
            }
          } }
          endAdornment={ <VoiceSearchButton onClick={ handleVoiceButtonClick } /> }
        />
        <CommandList className={ isMobile ? 'flex-1 max-h-full' : undefined }>
          { hasAnyFilters && (
            <CommandGroup heading="Filters">
              <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
                { filters.region && (
                  <FilterBadge
                    label={ `Region: ${filters.region}` }
                    onClear={ () =>
                      onFiltersApply({
                        region: '',
                        city: '',
                        barangay: '',
                      })
                    }
                  />
                ) }
                { filters.city && (
                  <FilterBadge
                    label={ `City: ${filters.city}` }
                    onClear={ () =>
                      onFiltersApply({
                        city: '',
                        barangay: '',
                      })
                    }
                  />
                ) }
                { filters.barangay && (
                  <FilterBadge
                    label={ `Barangay: ${filters.barangay}` }
                    onClear={ () => onFiltersApply({ barangay: '', }) }
                  />
                ) }
                { filters.amenities.map((amenity) => (
                  <FilterBadge
                    key={ `amenity-${amenity}` }
                    label={
                      filters.amenitiesNegate
                        ? `Exclude: ${amenity}`
                        : `Amenity: ${amenity}`
                    }
                    onClear={ () => handleAmenityRemove(amenity) }
                    variant={
                      filters.amenitiesNegate ? 'destructive' : 'default'
                    }
                  />
                )) }
              </div>
            </CommandGroup>
          ) }

          <CommandGroup heading="Actions">
            <CommandItem
              value="apply filters"
              onSelect={ () => setIsFilterDialogOpen(true) }
              className="hover:text-white data-[selected=true]:text-white"
            >
              <CgOptions className="size-4" aria-hidden="true" />
              <span>Apply filters</span>
              { hasAnyFilters && (
                <Badge variant="secondary" className="ml-auto">
                  Active
                </Badge>
              ) }
            </CommandItem>
            <CommandItem
              value={
                trimmedValue ? `search ${trimmedValue}` : 'search marketplace'
              }
              onSelect={ () => void onSearchSubmit() }
              className="group hover:text-white data-[selected=true]:text-white"
            >
              <FiSearch className="size-4" aria-hidden="true" />
              <span>Search marketplace</span>
              { trimmedValue && (
                <span className="truncate text-muted-foreground">
                  &quot;{ trimmedValue }&quot;
                </span>
              ) }
              <CommandShortcut className="flex items-center gap-1">
                <Kbd>Enter</Kbd>
              </CommandShortcut>
            </CommandItem>
            { hasActiveSearch && (
              <CommandItem
                value="clear search"
                onSelect={ () => void onSearchSubmit('') }
                className="group hover:text-white data-[selected=true]:text-white"
              >
                <FiX className="size-4" aria-hidden="true" />
                <span>Clear search</span>
              </CommandItem>
            ) }
            { hasAnyFilters && (
              <CommandItem
                value="clear filters"
                onSelect={ () =>
                  onFiltersApply({
                    region: '',
                    city: '',
                    barangay: '',
                    amenities: [],
                    amenitiesMode: 'any',
                    amenitiesNegate: false,
                  })
                }
                className="group hover:text-white data-[selected=true]:text-white"
              >
                <FiX className="size-4" aria-hidden="true" />
                <span>Clear filters</span>
              </CommandItem>
            ) }
          </CommandGroup>

          <CommandGroup heading="Suggestions">
            <p className="sr-only" aria-live="polite">
              { suggestionStatusMessage }
            </p>

            { !shouldFetchSuggestions && (
              <CommandItem disabled>
                <FiSearch className="size-4" aria-hidden="true" />
                <span>Type at least 2 characters to see suggestions</span>
              </CommandItem>
            ) }

            { shouldFetchSuggestions && isSuggestionError && (
              <CommandItem disabled>
                <FiX className="size-4" aria-hidden="true" />
                <div className="flex flex-col text-left">
                  <span>Suggestions unavailable</span>
                  <span className="text-xs text-muted-foreground">
                    Try again in a moment.
                  </span>
                </div>
              </CommandItem>
            ) }

            { shouldFetchSuggestions && isFetchingSuggestions && (
              <CommandItem disabled>
                <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                <span>Fetching suggestions…</span>
              </CommandItem>
            ) }

            { shouldFetchSuggestions &&
              suggestions.map((suggestion) => (
                <CommandItem
                  key={ suggestion.space_id }
                  value={ `suggest ${suggestion.name}` }
                  onSelect={ () => handleSuggestionSelect(suggestion) }
                  className="hover:text-white hover:[&_span.text-muted-foreground]:text-white/60 data-[selected=true]:text-white data-[selected=true]:[&_span.text-muted-foreground]:text-white/60"
                >
                  <Avatar
                    className="size-9 border border-border shadow-sm"
                    style={ { borderRadius: 4, } }
                  >
                    { suggestion.image_url ? (
                      <AvatarImage
                        src={ suggestion.image_url }
                        alt="Space preview"
                        style={ { borderRadius: 4, } }
                      />
                    ) : (
                      <AvatarFallback style={ { borderRadius: 4, } }>
                        { suggestion.name.slice(0, 2).toUpperCase() }
                      </AvatarFallback>
                    ) }
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-1 font-medium">
                      { suggestion.name }
                    </span>
                    { suggestion.location && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        { suggestion.location }
                      </span>
                    ) }
                  </div>
                </CommandItem>
              )) }

            { shouldFetchSuggestions &&
              !isFetchingSuggestions &&
              suggestions.length === 0 &&
              !isSuggestionError && (
                <CommandItem disabled>
                  <FiX className="size-4" aria-hidden="true" />
                  <span>No matching spaces yet.</span>
                </CommandItem>
              ) }
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <VoiceSearchDialog
        open={ isVoiceSearchOpen }
        onOpenChange={ setIsVoiceSearchOpen }
        onSubmit={ handleVoiceSearchSubmit }
      />
      <LocationFilterDialog
        open={ isFilterDialogOpen }
        onOpenChange={ setIsFilterDialogOpen }
        filters={ filters }
        onApply={ (nextFilters) => {
          onFiltersApply(nextFilters);
          setIsFilterDialogOpen(false);
        } }
      />
    </>
  );
}

type MarketplaceHighlightsSectionProps = {
  title: string;
  items: Space[];
  emptyMessage: string;
};

function MarketplaceHighlightsSection({
  title,
  items,
  emptyMessage,
}: MarketplaceHighlightsSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h3 className="text-2xl font-semibold text-foreground">{ title }</h3>
        { items.length > 0 && (
          <Badge
            variant="outline"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            { items.length } { items.length === 1 ? 'space' : 'spaces' }
          </Badge>
        ) }
      </div>
      { items.length === 0 ? (
        <div className="rounded-md border border-border/50 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
          { emptyMessage }
        </div>
      ) : (
        <CardsGrid items={ items } />
      ) }
    </section>
  );
}

type LocationFilterDialogProps = {
  open: boolean;
  filters: FiltersState;
  onApply: (filters: Partial<FiltersState>) => void;
  onOpenChange: (open: boolean) => void;
};

type AmenityChoice = {
  id: string;
  name: string;
  category: string | null;
  identifier: string | null;
};

function LocationFilterDialog({
  open,
  filters,
  onApply,
  onOpenChange,
}: LocationFilterDialogProps) {
  const [draftRegion, setDraftRegion] = React.useState(filters.region);
  const [draftCity, setDraftCity] = React.useState(filters.city);
  const [draftBarangay, setDraftBarangay] = React.useState(filters.barangay);
  const [draftAmenities, setDraftAmenities] = React.useState<string[]>(
    filters.amenities
  );
  const [amenitiesSearch, setAmenitiesSearch] = React.useState('');
  const [amenitiesMode, setAmenitiesMode] = React.useState<
    FiltersState['amenitiesMode']
  >(filters.amenitiesMode);
  const [amenitiesNegate, setAmenitiesNegate] = React.useState(
    filters.amenitiesNegate
  );
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (open) {
      setDraftRegion(filters.region);
      setDraftCity(filters.city);
      setDraftBarangay(filters.barangay);
      setDraftAmenities(filters.amenities);
      setAmenitiesMode(filters.amenitiesMode);
      setAmenitiesNegate(filters.amenitiesNegate);
      setAmenitiesSearch('');
    }
  }, [
    filters.amenities,
    filters.amenitiesMode,
    filters.amenitiesNegate,
    filters.barangay,
    filters.city,
    filters.region,
    open
  ]);

  React.useEffect(() => {
    if (draftAmenities.length === 0 && amenitiesNegate) {
      setAmenitiesNegate(false);
    }
  }, [amenitiesNegate, draftAmenities.length]);

  const {
    data: regionOptions = [],
    isLoading: isRegionsLoading,
    isError: isRegionsError,
  } = useQuery<PhilippineRegionOption[]>({
    queryKey: ['philippines', 'regions'],
    queryFn: fetchPhilippineRegions,
    enabled: open,
    staleTime: 1000 * 60 * 30,
  });

  const selectedRegion = React.useMemo(
    () => regionOptions.find((region) => region.name === draftRegion) ?? null,
    [draftRegion, regionOptions]
  );
  const regionCodeForQuery = selectedRegion?.code;

  const {
    data: cityOptions = [],
    isLoading: isCitiesLoading,
    isError: isCitiesError,
  } = useQuery<PhilippineCityOption[]>({
    queryKey: ['philippines', 'cities', regionCodeForQuery],
    queryFn: () => {
      if (!regionCodeForQuery) {
        return Promise.resolve<PhilippineCityOption[]>([]);
      }

      return fetchPhilippineCitiesByRegion(regionCodeForQuery);
    },
    enabled: open && Boolean(regionCodeForQuery),
    staleTime: 1000 * 60 * 30,
  });

  const dedupedCityOptions = React.useMemo(
    () => dedupeAddressOptions(cityOptions),
    [cityOptions]
  );
  const selectedCity = React.useMemo(
    () => dedupedCityOptions.find((city) => city.name === draftCity) ?? null,
    [dedupedCityOptions, draftCity]
  );
  const cityCodeForQuery = selectedCity?.code;

  const {
    data: barangayOptions = [],
    isLoading: isBarangaysLoading,
    isError: isBarangaysError,
  } = useQuery<PhilippineBarangayOption[]>({
    queryKey: ['philippines', 'barangays', cityCodeForQuery],
    queryFn: () => {
      if (!cityCodeForQuery) {
        return Promise.resolve<PhilippineBarangayOption[]>([]);
      }

      return fetchPhilippineBarangaysByCity(cityCodeForQuery);
    },
    enabled: open && Boolean(cityCodeForQuery),
    staleTime: 1000 * 60 * 30,
  });

  const dedupedBarangayOptions = React.useMemo(
    () => dedupeAddressOptions(barangayOptions),
    [barangayOptions]
  );

  const {
    data: amenityChoices = [],
    isLoading: isAmenitiesLoading,
    isError: isAmenitiesError,
    refetch: refetchAmenities,
  } = useQuery<AmenityChoice[]>({
    queryKey: ['amenity-choices'],
    queryFn: async () => {
      const response = await fetch('/api/v1/amenities/choices');
      if (!response.ok) {
        throw new Error('Failed to fetch amenity choices');
      }

      const payload = (await response.json()) as { data: AmenityChoice[] };
      return payload.data;
    },
    staleTime: 1000 * 60 * 10,
    enabled: open,
  });

  const groupedAmenities = React.useMemo(() => {
    if (!amenityChoices.length) return [];

    const grouped = new Map<string, AmenityChoice[]>();
    for (const amenity of amenityChoices) {
      const key = amenity.category ?? 'others';
      const group = grouped.get(key) ?? [];
      group.push(amenity);
      grouped.set(key, group);
    }

    const ordered: {
      key: string;
      label: string;
      amenities: AmenityChoice[];
    }[] = [];
    for (const key of ORDERED_AMENITY_CATEGORIES) {
      if (!grouped.has(key)) continue;
      ordered.push({
        key,
        label: AMENITY_CATEGORY_DISPLAY_MAP[key] ?? key,
        amenities: grouped.get(key)?.slice() ?? [],
      });
      grouped.delete(key);
    }

    for (const [key, amenitiesForKey] of grouped.entries()) {
      ordered.push({
        key,
        label: AMENITY_CATEGORY_DISPLAY_MAP[key] ?? key,
        amenities: amenitiesForKey.slice(),
      });
    }

    return ordered;
  }, [amenityChoices]);

  const normalizedAmenitySearch = amenitiesSearch.trim().toLowerCase();
  const filteredAmenityGroups = React.useMemo(() => {
    if (!normalizedAmenitySearch) return groupedAmenities;

    return groupedAmenities
      .map((group) => ({
        ...group,
        amenities: group.amenities.filter((amenity) =>
          amenity.name.toLowerCase().includes(normalizedAmenitySearch)
        ),
      }))
      .filter((group) => group.amenities.length > 0);
  }, [groupedAmenities, normalizedAmenitySearch]);

  const selectedAmenities = React.useMemo(
    () => normalizeAmenityValues(draftAmenities),
    [draftAmenities]
  );

  const regionDisabled = isRegionsLoading;
  const cityDisabled = !selectedRegion || isCitiesLoading;
  const barangayDisabled =
    !selectedCity || isBarangaysLoading || dedupedBarangayOptions.length === 0;

  const handleAmenityToggle = (amenityName: string) => {
    setDraftAmenities((prev) => {
      const normalized = normalizeFilterValue(amenityName);
      if (!normalized) return prev;

      if (prev.includes(normalized)) {
        return prev.filter((value) => value !== normalized);
      }

      return [...prev, normalized];
    });
  };

  const handleAmenityRemove = (amenityName: string) => {
    setDraftAmenities((prev) => prev.filter((value) => value !== amenityName));
  };

  const handleApplyFilters = () => {
    onApply({
      region: draftRegion,
      city: draftCity,
      barangay: draftBarangay,
      amenities: selectedAmenities,
      amenitiesMode: selectedAmenities.length > 0 ? amenitiesMode : 'any',
      amenitiesNegate: selectedAmenities.length > 0 ? amenitiesNegate : false,
    });
  };

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent
        className={ cn('space-y-8 pb-0', !isMobile && 'sm:max-w-[720px]') }
        position={ isMobile ? 'top' : 'center' }
        mobileFullScreen={ isMobile }
        fullWidth={ isMobile }
      >
        <DialogHeader>
          <DialogTitle>Advanced Filters</DialogTitle>
          <DialogDescription>
            Filter spaces by location, price, ratings, and amenities.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="marketplace-filter-region">Region / State</Label>
            <Select
              value={ draftRegion }
              onValueChange={ (value) => {
                setDraftRegion(value);
                setDraftCity('');
                setDraftBarangay('');
              } }
              disabled={ regionDisabled }
            >
              <SelectTrigger
                id="marketplace-filter-region"
                aria-label="Select region or state"
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    isRegionsLoading
                      ? 'Loading regions...'
                      : 'Select region / state'
                  }
                />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                avoidCollisions={ false }
              >
                { isRegionsError && (
                  <SelectItem value="regions-error" disabled>
                    Unable to load regions
                  </SelectItem>
                ) }
                { regionOptions.map((region) => (
                  <SelectItem key={ region.code } value={ region.name }>
                    { region.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace-filter-city">City</Label>
            <Select
              value={ draftCity }
              onValueChange={ (value) => {
                setDraftCity(value);
                setDraftBarangay('');
              } }
              disabled={ cityDisabled }
            >
              <SelectTrigger
                id="marketplace-filter-city"
                aria-label="Select city"
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    isCitiesLoading ? 'Loading cities...' : 'Select city'
                  }
                />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                avoidCollisions={ false }
              >
                { isCitiesError && (
                  <SelectItem value="cities-error" disabled>
                    Unable to load cities
                  </SelectItem>
                ) }
                { dedupedCityOptions.map((city) => (
                  <SelectItem
                    key={ `${city.code}-${city.name}` }
                    value={ city.name }
                  >
                    { city.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace-filter-barangay">Barangay</Label>
            <Select
              value={ draftBarangay }
              onValueChange={ (value) => setDraftBarangay(value) }
              disabled={ barangayDisabled }
            >
              <SelectTrigger
                id="marketplace-filter-barangay"
                aria-label="Select barangay"
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    !selectedCity
                      ? 'Select a city first'
                      : isBarangaysLoading
                        ? 'Loading barangays...'
                        : dedupedBarangayOptions.length === 0
                          ? 'No barangays available'
                          : 'Select barangay'
                  }
                />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                avoidCollisions={ false }
              >
                { isBarangaysError && (
                  <SelectItem value="barangays-error" disabled>
                    Unable to load barangays
                  </SelectItem>
                ) }
                { dedupedBarangayOptions.map((barangay) => (
                  <SelectItem
                    key={ `${barangay.code}-${barangay.name}` }
                    value={ barangay.name }
                  >
                    { barangay.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="amenities-search-input">Amenities</Label>
              <p className="text-sm text-muted-foreground">
                Search and select amenities to refine results. Click an amenity
                to add or remove it.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                <div className="flex flex-col">
                  <Label htmlFor="amenities-match-toggle">
                    { amenitiesMode === 'any' ? 'Any' : 'All' }
                  </Label>
                </div>
                <Switch
                  id="amenities-match-toggle"
                  checked={ amenitiesMode === 'any' }
                  onCheckedChange={ (checked) =>
                    setAmenitiesMode(checked ? 'any' : 'all')
                  }
                  disabled={ amenitiesNegate }
                  aria-label={ `Match ${amenitiesMode === 'any' ? 'any' : 'all'} amenities` }
                />
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                <div className="flex flex-col">
                  <Label htmlFor="amenities-negate-toggle">
                    { amenitiesNegate ? 'Exclude' : 'Include' }
                  </Label>
                </div>
                <Switch
                  id="amenities-negate-toggle"
                  checked={ amenitiesNegate }
                  onCheckedChange={ setAmenitiesNegate }
                  disabled={ selectedAmenities.length === 0 }
                  aria-label={
                    amenitiesNegate
                      ? 'Exclude selected amenities'
                      : 'Include selected amenities'
                  }
                />
              </div>
            </div>
          </div>

          <div className="relative">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="amenities-search-input"
              placeholder="Search amenities (click results to add)"
              value={ amenitiesSearch }
              onChange={ (event) => setAmenitiesSearch(event.target.value) }
              aria-label="Search amenities to filter"
              className="pl-9"
            />
          </div>

          { selectedAmenities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
              { selectedAmenities.map((amenity) => (
                <FilterBadge
                  key={ `selected-${amenity}` }
                  label={ amenitiesNegate ? `Exclude: ${amenity}` : amenity }
                  onClear={ () => handleAmenityRemove(amenity) }
                  variant={ amenitiesNegate ? 'destructive' : 'default' }
                />
              )) }
            </div>
          ) }

          <div className="rounded-lg border border-border/60 bg-muted/20">
            <ScrollArea className="h-[320px] w-full px-1">
              <div className="space-y-5 p-3">
                { isAmenitiesLoading ? (
                  <div
                    className="space-y-4"
                    role="status"
                    aria-label="Loading amenities"
                  >
                    <span className="sr-only">Loading amenities</span>
                    { Array.from({ length: 2, }).map((_, index) => (
                      <div key={ index } className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          { Array.from({ length: 4, }).map((_, cardIndex) => (
                            <div
                              key={ `${index}-${cardIndex}` }
                              className="rounded-md border border-border/60 bg-background/60 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Skeleton className="size-8 rounded-md" />
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-28" />
                                  <Skeleton className="h-3 w-16" />
                                </div>
                              </div>
                            </div>
                          )) }
                        </div>
                      </div>
                    )) }
                  </div>
                ) : isAmenitiesError ? (
                  <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <span>Unable to load amenities.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive underline"
                      onClick={ () => refetchAmenities() }
                    >
                      Retry
                    </Button>
                  </div>
                ) : filteredAmenityGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    { normalizedAmenitySearch
                      ? 'No amenities match your search.'
                      : 'No amenities available yet.' }
                  </p>
                ) : (
                  filteredAmenityGroups.map((group) => (
                    <section key={ group.key } className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          { group.label }
                        </h3>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          { group.amenities.length } option
                          { group.amenities.length === 1 ? '' : 's' }
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        { group.amenities.map((amenity) => {
                          const Icon = amenity.identifier
                            ? (AMENITY_ICON_MAPPINGS[amenity.identifier] ??
                              FiList)
                            : FiList;
                          const isSelected = selectedAmenities.includes(
                            amenity.name
                          );

                          return (
                            <button
                              key={ amenity.id }
                              type="button"
                              onClick={ () => handleAmenityToggle(amenity.name) }
                              className={ cn(
                                'flex items-center gap-3 rounded-md border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                isSelected
                                  ? amenitiesNegate
                                    ? 'border-destructive/60 bg-destructive/10 text-destructive shadow-sm hover:border-destructive/80'
                                    : 'border-primary bg-primary/5 text-foreground shadow-sm hover:border-primary/70'
                                  : 'border-border/60 bg-background/60 hover:border-primary/60'
                              ) }
                              aria-pressed={ isSelected }
                              aria-label={ `${isSelected ? 'Remove' : 'Add'} amenity ${amenity.name}` }
                            >
                              <Icon
                                className="size-4 text-foreground"
                                aria-hidden="true"
                              />
                              <span className="flex-1 text-sm font-medium text-foreground">
                                { amenity.name }
                              </span>
                              { isSelected && (
                                <Badge
                                  variant={
                                    amenitiesNegate
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="shrink-0"
                                >
                                  Selected
                                </Badge>
                              ) }
                            </button>
                          );
                        }) }
                      </div>
                    </section>
                  ))
                ) }
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={ () => onOpenChange(false) }
            className="hover:text-white"
          >
            Cancel
          </Button>
          <Button type="button" variant="default" onClick={ handleApplyFilters }>
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterBadge({
  label,
  onClear,
  variant = 'default',
}: {
  label: string;
  onClear: () => void;
  variant?: 'default' | 'destructive';
}) {
  return (
    <button
      type="button"
      onClick={ (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClear();
      } }
      className={ cn(
        'flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variant === 'destructive'
          ? 'border border-destructive/50 bg-destructive/10 text-gray-500 hover:bg-destructive/20'
          : 'bg-secondary text-white hover:bg-secondary/80'
      ) }
      aria-label={ `Clear ${label}` }
    >
      <span className="truncate">{ label }</span>
      <FiX className="size-3" aria-hidden="true" />
    </button>
  );
}
