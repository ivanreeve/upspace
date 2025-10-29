'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import MarketplaceHero from './Marketplace.Hero';
import { CardsGrid } from './Marketplace.Cards';
import MarketplaceFilters from './Marketplace.Filters';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_MIN_RATING,
  DEFAULT_PRICE_RANGE,
  type MarketplaceFilterState
} from './filters/constants';

import type { SpaceCard as SpaceCardData } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NEAR_ME_PAGE_SIZE = 8;

export default function Marketplace() {
  const [state, setState] = React.useState<MarketplaceFilterState>(() => ({
    q: DEFAULT_FILTER_STATE.q,
    amenities: [...DEFAULT_FILTER_STATE.amenities],
    priceRange: [...DEFAULT_FILTER_STATE.priceRange] as [number, number],
    minRating: DEFAULT_FILTER_STATE.minRating,
  }));
  const [nearMePage, setNearMePage] = React.useState(0);

  // Placeholder data for cards (no API call)
  const MOCK_SPACES: SpaceCardData[] = React.useMemo(() => ([
    {
      space_id: '1',
      name: 'Coworking Space Abcde',
      city: 'Manila',
      region: 'Metro Manila',
      address: 'Taft Ave, Manila',
      images: [
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png'
      ],
      price_min: 1500,
      price_max: 1900,
      rating: 4.6,
    },
    {
      space_id: '2',
      name: 'Modern Loft Workspace',
      city: 'Taguig',
      region: 'Metro Manila',
      address: '5th Ave, BGC',
      images: [
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png'
      ],
      price_min: 1800,
      price_max: 2200,
      rating: 4.8,
    },
    {
      space_id: '3',
      name: 'Creative Hub Studio',
      city: 'Pasig',
      region: 'Metro Manila',
      address: 'Emerald Ave, Ortigas',
      images: [
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 1200,
      price_max: 1600,
      rating: 4.4,
    },
    {
      space_id: '4',
      name: 'Quiet Focus Nook',
      city: 'Makati',
      region: 'Metro Manila',
      address: 'Legazpi Village, Makati',
      images: [
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png'
      ],
      price_min: 1400,
      price_max: 1800,
      rating: 4.7,
    },
    {
      space_id: '5',
      name: 'Open Collaboration Lab',
      city: 'Quezon City',
      region: 'Metro Manila',
      address: 'Katipunan Ave, QC',
      images: [
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 1000,
      price_max: 1500,
      rating: 4.3,
    },
    {
      space_id: '6',
      name: 'Boutique Work Lounge',
      city: 'Muntinlupa',
      region: 'Metro Manila',
      address: 'Filinvest City, Alabang',
      images: [
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 1700,
      price_max: 2100,
      rating: 4.5,
    },
    {
      space_id: '7',
      name: 'Riverside Desk Collective',
      city: 'Marikina',
      region: 'Metro Manila',
      address: 'Sumulong Hwy, Marikina',
      images: [
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png'
      ],
      price_min: 900,
      price_max: 1400,
      rating: 4.2,
    },
    {
      space_id: '8',
      name: 'Skyline View Offices',
      city: 'Pasay',
      region: 'Metro Manila',
      address: 'Roxas Blvd, Pasay',
      images: [
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 2000,
      price_max: 2600,
      rating: 4.9,
    },
    {
      space_id: '9',
      name: 'Harborfront Innovation Hub',
      city: 'Cebu City',
      region: 'Central Visayas',
      address: 'SRP, Cebu City',
      images: [
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png'
      ],
      price_min: 1300,
      price_max: 1700,
      rating: 4.1,
    },
    {
      space_id: '10',
      name: 'Laguna Lakeside Co-lab',
      city: 'Santa Rosa',
      region: 'Laguna',
      address: 'Nuvali Blvd, Santa Rosa',
      images: [
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 900,
      price_max: 1300,
      rating: 4.0,
    },
    {
      space_id: '11',
      name: 'Summit Ridge Offices',
      city: 'Tagaytay',
      region: 'Cavite',
      address: 'Tagaytay-Calamba Rd, Tagaytay',
      images: [
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png'
      ],
      price_min: 1100,
      price_max: 1600,
      rating: 4.3,
    },
    {
      space_id: '12',
      name: 'Baguio Pineview Workspace',
      city: 'Baguio',
      region: 'Cordillera',
      address: 'Session Rd, Baguio',
      images: [
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png'
      ],
      price_min: 800,
      price_max: 1200,
      rating: 4.4,
    },
    {
      space_id: '13',
      name: 'Clark Freeport Studios',
      city: 'Angeles',
      region: 'Pampanga',
      address: 'Clark Freeport Zone, Angeles',
      images: [
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png'
      ],
      price_min: 1500,
      price_max: 2100,
      rating: 4.6,
    },
    {
      space_id: '14',
      name: 'Iloilo Riverfront Commons',
      city: 'Iloilo City',
      region: 'Western Visayas',
      address: 'Iloilo Business Park, Iloilo',
      images: [
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 1200,
      price_max: 1700,
      rating: 4.2,
    },
    {
      space_id: '15',
      name: 'Davao Skyline Labs',
      city: 'Davao City',
      region: 'Davao Region',
      address: 'Lanang Business Park, Davao City',
      images: [
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png'
      ],
      price_min: 1400,
      price_max: 2000,
      rating: 4.5,
    },
    {
      space_id: '16',
      name: 'Cagayan de Oro Work Loft',
      city: 'Cagayan de Oro',
      region: 'Northern Mindanao',
      address: 'Pueblo de Oro, CDO',
      images: [
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png'
      ],
      price_min: 1000,
      price_max: 1400,
      rating: 4.1,
    },
    {
      space_id: '17',
      name: 'Subic Bay Collaboration Hub',
      city: 'Subic',
      region: 'Zambales',
      address: 'Subic Bay Freeport Zone',
      images: [
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png'
      ],
      price_min: 950,
      price_max: 1350,
      rating: 4.0,
    },
    {
      space_id: '18',
      name: 'Batangas Seaside Collective',
      city: 'Batangas City',
      region: 'Batangas',
      address: 'Calicanto, Batangas City',
      images: [
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png'
      ],
      price_min: 1050,
      price_max: 1550,
      rating: 4.2,
    },
    {
      space_id: '19',
      name: 'Ilocos Heritage Workspace',
      city: 'Vigan',
      region: 'Ilocos Region',
      address: 'Calle Crisologo, Vigan',
      images: [
        '/img/hero-featured-dark-4.png',
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png'
      ],
      price_min: 800,
      price_max: 1150,
      rating: 4.3,
    },
    {
      space_id: '20',
      name: 'Palawan Shoreline Studios',
      city: 'Puerto Princesa',
      region: 'Palawan',
      address: 'Rizal Ave, Puerto Princesa',
      images: [
        '/img/hero-featured-dark-1.png',
        '/img/hero-featured-dark-2.png',
        '/img/hero-featured-dark-3.png',
        '/img/hero-featured-dark-4.png'
      ],
      price_min: 1600,
      price_max: 2100,
      rating: 4.7,
    }
  ]), []);

  const filtered = React.useMemo(() => {
    const q = state.q.trim().toLowerCase();
    const hasAmenityFilters = state.amenities.length > 0;
    const hasPriceFilter =
      state.priceRange[0] !== DEFAULT_PRICE_RANGE[0] ||
      state.priceRange[1] !== DEFAULT_PRICE_RANGE[1];
    const hasRatingFilter = state.minRating !== DEFAULT_MIN_RATING;

    if (!q && !hasAmenityFilters && !hasPriceFilter && !hasRatingFilter) return MOCK_SPACES;

    // Placeholder: price and rating filters will apply once data is available
    return MOCK_SPACES.filter((s) => {
      const hay = `${s.name ?? ''} ${s.city ?? ''} ${s.region ?? ''} ${s.address ?? ''}`.toLowerCase();
      const matchesQuery = q ? hay.includes(q) : true;
      return matchesQuery;
    });
  }, [MOCK_SPACES, state.amenities, state.minRating, state.priceRange, state.q]);

  React.useEffect(() => {
    setNearMePage(0);
  }, [filtered]);

  const totalNearMePages = Math.ceil(filtered.length / NEAR_ME_PAGE_SIZE);
  React.useEffect(() => {
    if (totalNearMePages === 0) {
      if (nearMePage !== 0) setNearMePage(0);
      return;
    }
    const maxPage = Math.max(totalNearMePages - 1, 0);
    if (nearMePage > maxPage) {
      setNearMePage(maxPage);
    }
  }, [nearMePage, totalNearMePages]);

  const startIndex = nearMePage * NEAR_ME_PAGE_SIZE;
  const endIndex = startIndex + NEAR_ME_PAGE_SIZE;
  const nearMe = filtered.slice(startIndex, endIndex);
  const recommended = filtered.slice(endIndex);
  const showPagination = totalNearMePages > 1;
  const canGoPrev = nearMePage > 0;
  const canGoNext = nearMePage < totalNearMePages - 1;
  const currentPage = nearMePage + 1;

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

  const goToPage = React.useCallback((pageNumber: number) => {
    setNearMePage(Math.max(pageNumber - 1, 0));
  }, []);

  return (
    <div className="px-4 max-w-[1440px] mx-auto py-10">
      <MarketplaceHero />
      <MarketplaceFilters
        q={ state.q }
        amenities={ state.amenities }
        priceRange={ state.priceRange }
        minRating={ state.minRating }
        onChange={ setState }
        onSearch={ () => { /* no-op for placeholder */ } }
      />
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Near Me</h2>
        <CardsGrid items={ nearMe } />
        { showPagination ? (
          <nav
            className="mt-6 flex items-center justify-center gap-4 text-sm"
            aria-label="Near me pagination"
          >
            <button
              type="button"
              onClick={ () => setNearMePage((page) => Math.max(page - 1, 0)) }
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
                    onClick={ () => goToPage(item) }
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
              onClick={ () => setNearMePage((page) => Math.min(page + 1, totalNearMePages - 1)) }
              disabled={ !canGoNext }
              className="flex items-center gap-1 text-sm font-medium text-foreground transition hover:text-primary disabled:pointer-events-none disabled:text-muted-foreground"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null }
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Recommended for you</h2>
        <CardsGrid items={ recommended } />
      </section>

      <BackToTopButton />
    </div>
  );
}
