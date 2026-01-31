import { cookies } from 'next/headers';

import LandingPage from '@/components/pages/LandingPage/LandingPage';
import { Footer } from '@/components/ui/footer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Use ISR with 1 hour revalidation for static landing page content
// Session check still happens dynamically via cookies
export const revalidate = 3600;

export default async function Home() {
  // Force dynamic cookie access to check auth state
  const cookieStore = await cookies();
  let showHero = true;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, } = await supabase.auth.getSession();

    showHero = !Boolean(data?.session?.user);
  } catch (error) {
    console.warn('Failed to determine landing page session state', error);
  }

  return (
    <>
      <LandingPage showHero={ showHero } />
      <Footer />
    </>
  );
}
