import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import SpacesPage from '@/components/pages/Spaces/SpacesPage';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { Footer } from '@/components/ui/footer';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Partner Spaces | UpSpace',
  description: 'Manage listings, monitor utilization, and resolve partner tasks for every UpSpace location.',
};

export default async function SpacesRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <SpacesPage />
      <Footer />
    </SpacesChrome>
  );
}
