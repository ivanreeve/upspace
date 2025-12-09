import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { SpacesPriceRulesPage } from '@/components/pages/Spaces/SpacesPriceRulesPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Pricing Rules | UpSpace',
  description: 'Manage reusable pricing rules for your spaces.',
};

export default async function PricingRulesRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <SpacesPriceRulesPage />
    </SpacesChrome>
  );
}
