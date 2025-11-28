import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { PartnerMessagesList } from '@/components/pages/Marketplace/PartnerMessagesList';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Partner Messages | UpSpace',
  description: 'Browse customer conversations and open a dedicated chat thread.',
};

export default async function SpacesMessagesPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <PartnerMessagesList />
      </div>
    </SpacesChrome>
  );
}
