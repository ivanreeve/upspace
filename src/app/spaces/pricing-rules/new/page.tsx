import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { PriceRuleCreationPage } from '@/components/pages/Spaces/PriceRuleCreationPage';
import { requirePartnerSession } from '@/lib/auth/require-partner-session';
import { getPartnerSpaces } from '@/lib/queries/partner-spaces';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'New Pricing Rule | UpSpace',
  description: 'Create a reusable pricing rule for your space.',
};

export default async function PricingRuleNewRoute() {
  const session = await requirePartnerSession().catch(() => null);
  if (!session) {
    redirect('/');
  }

  const initialSpaces = await getPartnerSpaces(session.userId).catch(() => []);

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <PriceRuleCreationPage initialSpaces={ initialSpaces } />
    </SpacesChrome>
  );
}
