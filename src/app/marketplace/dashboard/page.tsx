import { cookies } from 'next/headers';

import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { PartnerMessagesPanel } from '@/components/pages/Marketplace/PartnerMessagesPanel';

export const metadata = {
  title: 'Partner Messages | UpSpace',
  description: 'Reply to customer conversations and keep responses in sync with Supabase Realtime.',
};

export default async function MarketplaceDashboardPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <PartnerMessagesPanel />
    </MarketplaceChrome>
  );
}
