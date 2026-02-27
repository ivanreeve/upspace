import { Suspense } from 'react';
import type { Metadata } from 'next';

import Marketplace from '@/components/pages/Marketplace/Marketplace';

export const metadata: Metadata = {
  title: 'Marketplace | UpSpace',
  description: 'Browse, filter, and compare coworking spaces tailored to your preferred location and amenities.',
};

export default function MarketplacePage() {
  return (
    <Suspense fallback={ null }>
      <Marketplace />
    </Suspense>
  );
}
