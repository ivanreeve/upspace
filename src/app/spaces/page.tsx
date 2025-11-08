import type { Metadata } from 'next';

import SpacesPage from '@/components/pages/Spaces/SpacesPage';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Partner Spaces | UpSpace',
  description: 'Manage listings, monitor utilization, and resolve partner tasks for every UpSpace location.',
};

export default function SpacesRoute() {
  return (
    <>
      <NavBar />
      <SpacesPage />
      <Footer />
    </>
  );
}
