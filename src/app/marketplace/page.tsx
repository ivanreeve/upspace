import { cookies } from 'next/headers';

import Marketplace from '@/components/pages/Marketplace/Marketplace';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export default function MarketplacePage() {
  const sidebarCookie = cookies().get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <Marketplace initialSidebarOpen={ initialSidebarOpen } />
  );
}
