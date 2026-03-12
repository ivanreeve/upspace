import type { Metadata } from 'next';

import LandingPage from '@/components/pages/LandingPage/LandingPage';
import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'UpSpace | Coworking Marketplace',
  description: 'Discover flexible coworking spaces, compare amenities, and book work-ready locations in minutes.',
};

export default function Home() {
  return (
    <>
      <LandingPage showHero />
      <Footer />
    </>
  );
}
