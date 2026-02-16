import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import WalletPage from '@/components/pages/Wallet/WalletPage';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Wallet | UpSpace',
  description: 'Manage your PayMongo wallet balance, top-ups, and recent transactions.',
};

export default async function WalletRoutePage() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <WalletPage />
    </SpacesChrome>
  );
}
