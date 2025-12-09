import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { SpacesAnalyticsPanel } from '@/components/pages/Spaces/SpacesPage.Analytics';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Partner Dashboard | UpSpace',
  description: 'Monitor booking health and space performance across your UpSpace listings.',
};

export default async function SpacesDashboardPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <div className="space-y-8 px-4 pb-8 sm:px-6 lg:px-10">
        <SpacesAnalyticsPanel />
      </div>
    </SpacesChrome>
  );
}
