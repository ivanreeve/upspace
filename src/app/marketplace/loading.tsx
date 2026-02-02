import { cookies } from 'next/headers';

import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { SkeletonGrid } from '@/components/pages/Marketplace/Marketplace.Cards';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { Skeleton } from '@/components/ui/skeleton';

export default async function LoadingMarketplacePage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <SkeletonGrid count={ 12 } />
        </div>
      </section>
    </MarketplaceChrome>
  );
}
