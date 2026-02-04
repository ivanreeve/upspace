import { cookies } from 'next/headers';

import { MarketplaceChromeProvider } from '@/components/pages/Marketplace/MarketplaceChromeProvider';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export default async function MarketplaceLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChromeProvider initialSidebarOpen={ initialSidebarOpen }>
      { children }
    </MarketplaceChromeProvider>
  );
}
