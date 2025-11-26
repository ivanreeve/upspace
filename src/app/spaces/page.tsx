import type { Metadata } from 'next';

import SpacesPage from '@/components/pages/Spaces/SpacesPage';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Partner Spaces | UpSpace',
  description: 'Manage listings, monitor utilization, and resolve partner tasks for every UpSpace location.',
};

export default function SpacesRoute() {
  return (
    <SpacesChrome>
      <SpacesPage />
      <Footer />
    </SpacesChrome>
  );
}
