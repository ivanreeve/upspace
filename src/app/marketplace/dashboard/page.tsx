import { cookies } from 'next/headers';

import { MarketplaceDashboardContent } from './MarketplaceDashboardContent';

import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata = {
  title: 'Admin Dashboard | UpSpace',
  description:
    'Unified audit log spanning bookings, coworking spaces, client registrations, and partner verifications.',
};

export default async function MarketplaceDashboardPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <MarketplaceDashboardContent />
    </MarketplaceChrome>
  );
}
