import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AiSearch } from '@/components/pages/Marketplace/AiSearch';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'AI Search | UpSpace',
  description: 'Ask for exactly what your team needs and let UpSpace shape the filters for you.',
};

export default async function MarketplaceAiSearchPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <AiSearch />
    </MarketplaceChrome>
  );
}
