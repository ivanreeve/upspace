import LandingPage from '@/components/pages/LandingPage/LandingPage';
import { Footer } from '@/components/ui/footer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Home() {
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
