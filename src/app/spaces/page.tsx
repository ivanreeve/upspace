import type { Metadata } from 'next';

import SpacesPage from '@/components/pages/Spaces/SpacesPage';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Partner Spaces | UpSpace',
  description: 'Manage listings, monitor utilization, and resolve partner tasks for every UpSpace location.',
};

export default function SpacesRoute() {
  return (
    <MarketplaceChrome>
      <SpacesPage />
      <Footer />
    </MarketplaceChrome>
  );
}
