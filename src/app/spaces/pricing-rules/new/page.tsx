import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { PriceRuleCreationPage } from '@/components/pages/Spaces/PriceRuleCreationPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'New Pricing Rule | UpSpace',
  description: 'Create a reusable pricing rule for your space.',
};

export default async function PricingRuleNewRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <PriceRuleCreationPage />
    </SpacesChrome>
  );
}
