'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import MarketplaceHero from './Marketplace.Hero';
import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import MarketplaceFilters from './Marketplace.Filters';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_MIN_RATING,
  DEFAULT_PRICE_RANGE,
  type MarketplaceFilterState
} from './filters/constants';

import { type ListSpacesParams, type SpaceCard as SpaceCardData } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSpaces } from '@/lib/queries/spaces';

const NEAR_ME_PAGE_SIZE = 8;

function cloneFilterState(value: MarketplaceFilterState): MarketplaceFilterState {
  const amenities = Array.isArray(value.amenities) ? value.amenities : [];
  const priceRange = Array.isArray(value.priceRange) ? value.priceRange : DEFAULT_PRICE_RANGE;
  const q = typeof value.q === 'string' ? value.q : '';
  const minRating = typeof value.minRating === 'number' ? value.minRating : DEFAULT_MIN_RATING;

  return {
    ...value,
    q,
    amenities: [...amenities],
    priceRange: [...priceRange] as [number, number],
    minRating,
  };
}

function isDefaultPriceRange(range: [number, number]) {
  return range[0] === DEFAULT_PRICE_RANGE[0] && range[1] === DEFAULT_PRICE_RANGE[1];
}

export default function Marketplace() {
  const [state, setState] = React.useState<MarketplaceFilterState>(() => cloneFilterState(DEFAULT_FILTER_STATE));
  const [appliedFilters, setAppliedFilters] = React.useState<MarketplaceFilterState>(
    () => cloneFilterState(DEFAULT_FILTER_STATE)
  );
  const [nearMePage, setNearMePage] = React.useState(0);

  const queryParams = React.useMemo<ListSpacesParams>(() => {
    const params: ListSpacesParams = {
      limit: NEAR_ME_PAGE_SIZE,
      sort: 'name',
      order: 'asc',
    };
    const q = (typeof appliedFilters.q === 'string' ? appliedFilters.q : '').trim();
    if (q.length > 0) {
      params.q = q;
    }
    const amenities = Array.isArray(appliedFilters.amenities) ? appliedFilters.amenities : [];
    if (amenities.length > 0) {
      params.amenities = amenities;
      params.amenities_mode = 'all';
    }
    const priceRange = Array.isArray(appliedFilters.priceRange)
      ? appliedFilters.priceRange as [number, number]
      : DEFAULT_PRICE_RANGE;
    if (!isDefaultPriceRange(priceRange)) {
      params.min_rate_price = priceRange[0];
      params.max_rate_price = priceRange[1];
    }
    return params;
  }, [appliedFilters]);

  const {
    data,
    error,
    isError,
    isFetching,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSpaces(queryParams);

  const pages = data?.pages ?? [];

  const filteredPages = React.useMemo(() => {
    if (appliedFilters.minRating <= DEFAULT_MIN_RATING) {
      return pages;
    }
    return pages.map((page) => ({
      ...page,
      data: page.data.filter((item) => {
        const rating = typeof item.rating === 'number' ? item.rating : 0;
        return rating >= appliedFilters.minRating;
      }),
    }));
  }, [appliedFilters.minRating, pages]);

  const totalFetchedPages = filteredPages.length;
  const totalNearMePages = totalFetchedPages + (hasNextPage ? 1 : 0);
  const currentPageIndex = totalFetchedPages === 0 ? 0 : Math.min(nearMePage, totalFetchedPages - 1);
  const nearMe: SpaceCardData[] = filteredPages[currentPageIndex]?.data ?? [];
  const currentPage = currentPageIndex + 1;

  const recommended = React.useMemo<SpaceCardData[]>(() => {
    if (filteredPages.length === 0) return [];
    const items: SpaceCardData[] = [];
    filteredPages.forEach((page, idx) => {
      if (idx === currentPageIndex) return;
      items.push(...page.data);
    });
    return items;
  }, [currentPageIndex, filteredPages]);

  const applyFilters = React.useCallback((next?: MarketplaceFilterState) => {
    const source = next ? cloneFilterState(next) : cloneFilterState(state);
    setAppliedFilters(source);
    setNearMePage(0);
  }, [state]);

  const showPagination = totalNearMePages > 1;
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = totalFetchedPages > 0
    ? (currentPageIndex < totalFetchedPages - 1) || (currentPageIndex === totalFetchedPages - 1 && hasNextPage)
    : false;

  const paginationRange = React.useMemo(() => {
    if (!showPagination) return [];
    const total = totalNearMePages;
    const current = currentPage;
    const siblingCount = 1;
    const totalPageNumbers = siblingCount * 2 + 5;

    if (total <= totalPageNumbers) {
      return Array.from({ length: total, }).map((_, idx) => idx + 1);
    }

    const firstPage = 1;
    const lastPage = total;
    const leftSibling = Math.max(current - siblingCount, firstPage + 1);
    const rightSibling = Math.min(current + siblingCount, lastPage - 1);

    const showLeftDots = leftSibling > firstPage + 1;
    const showRightDots = rightSibling < lastPage - 1;

    const pages: Array<number | 'left-ellipsis' | 'right-ellipsis'> = [firstPage];

    if (!showLeftDots) {
      for (let page = firstPage + 1; page < leftSibling; page += 1) {
        pages.push(page);
      }
    } else {
      pages.push('left-ellipsis');
    }

    for (let page = leftSibling; page <= rightSibling; page += 1) {
      pages.push(page);
    }

    if (!showRightDots) {
      for (let page = rightSibling + 1; page < lastPage; page += 1) {
        pages.push(page);
      }
    } else {
      pages.push('right-ellipsis');
    }

    pages.push(lastPage);
    return pages;
  }, [currentPage, showPagination, totalNearMePages]);

  const goToPage = React.useCallback(async (pageNumber: number) => {
    const targetIndex = Math.max(pageNumber - 1, 0);
    if (targetIndex < totalFetchedPages) {
      setNearMePage(targetIndex);
      return;
    }
    if (!hasNextPage || isFetchingNextPage) return;
    await fetchNextPage();
    setNearMePage(targetIndex);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, totalFetchedPages]);

  const handleNext = React.useCallback(async () => {
    if (currentPageIndex < totalFetchedPages - 1) {
      setNearMePage(currentPageIndex + 1);
      return;
    }
    if (!hasNextPage || isFetchingNextPage) return;
    await fetchNextPage();
    setNearMePage(totalFetchedPages);
  }, [currentPageIndex, fetchNextPage, hasNextPage, isFetchingNextPage, totalFetchedPages]);

  const handlePrev = React.useCallback(() => {
    setNearMePage(Math.max(currentPageIndex - 1, 0));
  }, [currentPageIndex]);

  const isLoading = isPending && !data;
  const showSkeleton = isLoading || (isFetching && totalFetchedPages === 0);

  return (
    <div className="px-4 max-w-[1440px] mx-auto py-10">
      <MarketplaceHero />
      <MarketplaceFilters
        q={ state.q }
        amenities={ state.amenities }
        priceRange={ state.priceRange }
        minRating={ state.minRating }
        onChange={ setState }
        onSearch={ applyFilters }
      />
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Near Me</h2>
        { isError ? (
          <div className="text-sm text-destructive">
            Failed to load spaces. { error instanceof Error ? error.message : 'Please try again.' }
          </div>
        ) : showSkeleton ? (
          <SkeletonGrid count={ NEAR_ME_PAGE_SIZE } />
        ) : (
          <CardsGrid items={ nearMe } />
        ) }
        { showPagination && !showSkeleton && !isError ? (
          <nav
            className="mt-6 flex items-center justify-center gap-4 text-sm"
            aria-label="Near me pagination"
          >
            <button
              type="button"
              onClick={ handlePrev }
              disabled={ !canGoPrev }
              className="flex items-center gap-1 text-sm font-medium text-foreground transition hover:text-primary disabled:pointer-events-none disabled:text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              { paginationRange.map((item, idx) => {
                if (typeof item === 'string') {
                  return (
                    <span
                      key={ `${item}-${idx}` }
                      className="flex h-8 w-8 items-center justify-center text-muted-foreground"
                      aria-hidden="true"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  );
                }

                const isActive = item === currentPage;
                return (
                  <button
                    key={ item }
                    type="button"
                    onClick={ () => { void goToPage(item); } }
                    aria-current={ isActive ? 'page' : undefined }
                    className={ cn(
                      buttonVariants({
                        variant: isActive ? 'default' : 'ghost',
                        size: 'sm',
                      }),
                      'h-8 w-8 rounded-lg px-0 text-sm font-medium',
                      !isActive && 'text-foreground hover:bg-muted'
                    ) }
                  >
                    { item }
                  </button>
                );
              }) }
            </div>

            <button
              type="button"
              onClick={ () => { void handleNext(); } }
              disabled={ !canGoNext || isFetchingNextPage }
              className="flex items-center gap-1 text-sm font-medium text-foreground transition hover:text-primary disabled:pointer-events-none disabled:text-muted-foreground"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null }
      </section>


      <BackToTopButton />
    </div>
  );
}
