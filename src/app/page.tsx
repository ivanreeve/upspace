import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import LandingPage from '@/components/pages/LandingPage/LandingPage';
import { Footer } from '@/components/ui/footer';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';

// Force dynamic rendering — auth state must always be fresh
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'UpSpace | Coworking Marketplace',
  description: 'Discover flexible coworking spaces, compare amenities, and book work-ready locations in minutes.',
};

export default async function Home() {
  let isAuthenticated = false;

  try {
    const supabase = await createSupabaseReadOnlyServerClient();
    const { data, } = await supabase.auth.getSession();
    isAuthenticated = Boolean(data?.session?.user);
  } catch (error) {
    console.warn('Failed to determine landing page session state', error);
  }

  if (isAuthenticated) {
    redirect('/marketplace');
  }

  return (
    <>
      <LandingPage showHero />
      <Footer />
    </>
  );
}
