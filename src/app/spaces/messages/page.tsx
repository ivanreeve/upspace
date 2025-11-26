import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { PartnerMessagesPanel } from '@/components/pages/Marketplace/PartnerMessagesPanel';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Partner Messages | UpSpace',
  description: 'Reply to customers and manage conversation threads alongside your spaces.',
};

export default async function SpacesMessagesPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <PartnerMessagesPanel />
      </div>
    </SpacesChrome>
  );
}
