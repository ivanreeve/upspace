import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import AccountPage from '@/components/pages/Account/AccountPage';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { prisma } from '@/lib/prisma';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Settings | UpSpace',
  description: 'Manage your customer settings and notification preferences.',
};

export default async function CustomerSettingsPage() {
  const supabase = await createSupabaseReadOnlyServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!dbUser) {
    redirect('/');
  }

  if (dbUser.role === 'partner') {
    redirect('/partner/settings');
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <AccountPage />
    </MarketplaceChrome>
  );
}
