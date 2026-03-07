import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { CustomerComplaintsPage } from '@/components/pages/Customer/CustomerComplaintsPage';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Complaints | UpSpace',
  description: 'Track the status of complaints filed for your bookings.',
};

export default async function CustomerComplaintsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <CustomerComplaintsPage />
    </MarketplaceChrome>
  );
}
