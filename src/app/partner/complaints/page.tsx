import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { PartnerComplaintsPage } from '@/components/pages/Spaces/PartnerComplaintsPage';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Complaints | UpSpace',
  description: 'Review and manage complaints from your customers.',
};

export default async function PartnerComplaintsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <PartnerComplaintsPage />
    </MarketplaceChrome>
  );
}
