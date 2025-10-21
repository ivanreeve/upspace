'use client';

import React from 'react';

import MarketplaceHero from './Marketplace.Hero';
import { CardsGrid } from './Marketplace.Cards';
import MarketplaceFilters from './Marketplace.Filters';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_MIN_RATING,
  DEFAULT_PRICE_RANGE,
  type MarketplaceFilterState
} from './filters/constants';

import type { Space } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';

export default function Marketplace() {
  const [state, setState] = React.useState<MarketplaceFilterState>(() => ({
    q: DEFAULT_FILTER_STATE.q,
    amenities: [...DEFAULT_FILTER_STATE.amenities],
    priceRange: [...DEFAULT_FILTER_STATE.priceRange] as [number, number],
    minRating: DEFAULT_FILTER_STATE.minRating,
  }));

  // Placeholder data for cards (no API call)
  const MOCK_SPACES: Space[] = React.useMemo(() => ([
    {
 space_id: '1',
name: 'Coworking Space Abcde',
city: 'Taft',
region: 'Manila',
country: 'PH',
postal_code: '1000',
image_url: '/img/hero-featured-dark-1.png', 
},
    {
 space_id: '2',
name: 'Modern Loft Workspace',
city: 'BGC',
region: 'Taguig',
country: 'PH',
postal_code: '1634',
image_url: '/img/hero-featured-dark-2.png', 
},
    {
 space_id: '3',
name: 'Creative Hub Studio',
city: 'Ortigas',
region: 'Pasig',
country: 'PH',
postal_code: '1605',
image_url: '/img/hero-featured-dark-3.png', 
},
    {
 space_id: '4',
name: 'Quiet Focus Nook',
city: 'Makati',
region: 'Metro Manila',
country: 'PH',
postal_code: '1200',
image_url: '/img/hero-featured-dark-4.png', 
},
    {
 space_id: '5',
name: 'Open Collaboration Lab',
city: 'Quezon City',
region: 'Metro Manila',
country: 'PH',
postal_code: '1100',
image_url: '/img/hero-featured-dark-2.png', 
},
    {
 space_id: '6',
name: 'Boutique Work Lounge',
city: 'Alabang',
region: 'Muntinlupa',
country: 'PH',
postal_code: '1780',
image_url: '/img/hero-featured-dark-3.png', 
},
    {
 space_id: '7',
name: 'Riverside Desk Collective',
city: 'Marikina',
region: 'Metro Manila',
country: 'PH',
postal_code: '1800',
image_url: '/img/hero-featured-dark-4.png', 
},
    {
 space_id: '8',
name: 'Skyline View Offices',
city: 'Pasay',
region: 'Metro Manila',
country: 'PH',
postal_code: '1300',
image_url: '/img/hero-featured-dark-1.png', 
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
      const hay = `${s.name ?? ''} ${s.city ?? ''} ${s.region ?? ''}`.toLowerCase();
      const matchesQuery = q ? hay.includes(q) : true;
      return matchesQuery;
    });
  }, [MOCK_SPACES, state.amenities, state.minRating, state.priceRange, state.q]);

  const nearMe = filtered.slice(0, 4);
  const recommended = filtered.slice(4);

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
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Recommended for you</h2>
        <CardsGrid items={ recommended } />
      </section>

      <BackToTopButton />
    </div>
  );
}
