import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AiAssistant } from '@/components/pages/Marketplace/AiAssistant';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'AI Assistant | UpSpace',
  description: 'Get personalized help finding spaces, comparing options, planning your budget, and booking your ideal coworking workspace.',
};

export default async function MarketplaceAiAssistantPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <AiAssistant />
    </MarketplaceChrome>
  );
}
