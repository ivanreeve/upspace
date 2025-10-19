"use client";

import React from 'react';
import type { Space } from '@/lib/api/spaces';
import MarketplaceHero from './Marketplace.Hero';
import { CardsGrid } from './Marketplace.Cards';
import BackToTopButton from '@/components/ui/back-to-top';

export default function Marketplace() {
  const [state, setState] = React.useState<{ q: string; amenities: string[] }>({ q: '', amenities: [] });

  // Placeholder data for cards (no API call)
  const MOCK_SPACES: Space[] = React.useMemo(() => ([
    { space_id: '1', name: 'Coworking Space Abcde', city: 'Taft', region: 'Manila', country: 'PH', postal_code: '1000', image_url: '/img/hero-featured-dark-1.png' },
    { space_id: '2', name: 'Modern Loft Workspace', city: 'BGC', region: 'Taguig', country: 'PH', postal_code: '1634', image_url: '/img/hero-featured-dark-2.png' },
    { space_id: '3', name: 'Creative Hub Studio', city: 'Ortigas', region: 'Pasig', country: 'PH', postal_code: '1605', image_url: '/img/hero-featured-dark-3.png' },
    { space_id: '4', name: 'Quiet Focus Nook', city: 'Makati', region: 'Metro Manila', country: 'PH', postal_code: '1200', image_url: '/img/hero-featured-dark-4.png' },
    { space_id: '5', name: 'Open Collaboration Lab', city: 'Quezon City', region: 'Metro Manila', country: 'PH', postal_code: '1100', image_url: '/img/hero-featured-dark-2.png' },
    { space_id: '6', name: 'Boutique Work Lounge', city: 'Alabang', region: 'Muntinlupa', country: 'PH', postal_code: '1780', image_url: '/img/hero-featured-dark-3.png' },
    { space_id: '7', name: 'Riverside Desk Collective', city: 'Marikina', region: 'Metro Manila', country: 'PH', postal_code: '1800', image_url: '/img/hero-featured-dark-4.png' },
    { space_id: '8', name: 'Skyline View Offices', city: 'Pasay', region: 'Metro Manila', country: 'PH', postal_code: '1300', image_url: '/img/hero-featured-dark-1.png' },
  ]), []);

  const filtered = React.useMemo(() => {
    const q = state.q.trim().toLowerCase();
    if (!q && state.amenities.length === 0) return MOCK_SPACES;
    // Since this is placeholder, only basic text search is applied
    return MOCK_SPACES.filter((s) => {
      const hay = `${s.name ?? ''} ${s.city ?? ''} ${s.region ?? ''}`.toLowerCase();
      return q ? hay.includes(q) : true;
    });
  }, [MOCK_SPACES, state.q, state.amenities]);

  const nearMe = filtered.slice(0, 4);
  const recommended = filtered.slice(4);

  return (
    <div className="px-4 max-w-[1440px] mx-auto py-10">
      <MarketplaceHero />

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Near Me</h2>
        <CardsGrid items={nearMe} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Recommended for you</h2>
        <CardsGrid items={recommended} />
      </section>

      <BackToTopButton />
    </div>
  );
}
