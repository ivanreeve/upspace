'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';
import { MarketplaceSearchDialog, type FiltersState } from './Marketplace.Search';

import { listSpaces, type Space } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useMarketplaceChromeSlot } from '@/components/pages/Marketplace/MarketplaceChromeProvider';

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

// --- Highlights Section ---

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

// --- Main Component ---

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

      setFilters((current) =>
        areFiltersEqual(current, next) ? current : next
      );

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

      setIsSearchOpen(false);
      applyFilters(nextFilters);
    },
    [applyFilters, pendingFilters, searchValue]
  );

  React.useEffect(() => {
    const searchParam = searchParams.get('q');
    if (searchParam) {
      const searchString = new URLSearchParams(searchParams.toString());
      searchString.delete('q');
      applyFilters({ q: searchParam, });
      const nextUrl = `${pathname}${searchString.toString() ? `?${searchString}` : ''}`;
      router.replace(nextUrl, { scroll: false, });
    }
  }, [applyFilters, pathname, router, searchParams]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const {
   data: spaces = [], isLoading, isFetching, error, refetch,
} = useQuery({
    queryKey: ['marketplace-spaces', filters],
    queryFn: async () => listSpaces(buildQueryParams(filters)),
    select: (result) => (result?.data ?? []).filter((space) => space.status === 'Live'),
  });

  const hasError = Boolean(error);
  const hasActiveSearch = Boolean(filters.q.trim());
  const hasLocationFilters = Boolean(
    filters.region || filters.city || filters.barangay
  );
  const hasAmenityFilters = filters.amenities.length > 0;
  const hasAnyFilters = hasLocationFilters || hasAmenityFilters;

  const shouldShowCuratedCarousels = !hasActiveSearch && !hasAnyFilters;

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
    if (!shouldShowCuratedCarousels) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    topRatedSpaces.forEach((space) => ids.add(space.space_id));
    nearYouSpaces.forEach((space) => ids.add(space.space_id));
    return ids;
  }, [topRatedSpaces, nearYouSpaces, shouldShowCuratedCarousels]);

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

  const shouldShowPagination = totalRestPages > 1 && !isLoading;

  const appliedFilters = React.useMemo(() => {
    const items: {
      key: string;
      label: string;
      variant: 'secondary' | 'destructive';
    }[] = [];

    if (filters.region) {
      items.push({
        key: `region-${filters.region}`,
        label: `Region: ${filters.region}`,
        variant: 'secondary',
      });
    }
    if (filters.city) {
      items.push({
        key: `city-${filters.city}`,
        label: `City: ${filters.city}`,
        variant: 'secondary',
      });
    }
    if (filters.barangay) {
      items.push({
        key: `barangay-${filters.barangay}`,
        label: `Barangay: ${filters.barangay}`,
        variant: 'secondary',
      });
    }

    if (filters.amenities.length > 0) {
      items.push({
        key: `amenities-mode-${filters.amenitiesMode}`,
        label: filters.amenitiesMode === 'all' ? 'Amenities: Match all' : 'Amenities: Match any',
        variant: 'secondary',
      });

      filters.amenities.forEach((amenity) => {
        items.push({
          key: `${filters.amenitiesNegate ? 'exclude' : 'amenity'}-${amenity}`,
          label: filters.amenitiesNegate ? `Exclude: ${amenity}` : `Amenity: ${amenity}`,
          variant: filters.amenitiesNegate ? 'destructive' : 'secondary',
        });
      });
    }

    return items;
  }, [
    filters.region,
    filters.city,
    filters.barangay,
    filters.amenities,
    filters.amenitiesMode,
    filters.amenitiesNegate
  ]);

  const curatedCarousels =
    !shouldShowCuratedCarousels ||
      (nearYouSpaces.length === 0 && topRatedSpaces.length === 0) ? null : (
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
          { hasAnyFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Applied filters:
              </span>
              { appliedFilters.map((filter) => (
                <Badge
                  key={ filter.key }
                  variant={ filter.variant }
                >
                  { filter.label }
                </Badge>
              )) }
            </div>
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
