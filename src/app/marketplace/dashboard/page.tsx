import { cookies } from 'next/headers';

import { Badge } from '@/components/ui/badge';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata = {
  title: 'Admin Dashboard | UpSpace',
  description: 'Gather a quick pulse on partner activity and metrics (coming soon).',
};

export default async function MarketplaceDashboardPage() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <section className="mx-auto max-w-5xl space-y-6 py-10 px-4 md:py-12 md:px-0">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Admin dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Portfolio health</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Insights and automations for partner spaces are still in the oven, but we&apos;ll share them with you here soon.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-12 text-center md:px-8 md:py-16">
          <Badge
            variant="outline"
            className="mx-auto w-fit text-[10px] uppercase tracking-wide text-muted-foreground md:text-xs"
          >
            Coming soon
          </Badge>
          <p className="mt-3 text-xs text-muted-foreground md:mt-4 md:text-sm">
            We&apos;re building occupancy, approvals, and task insights for every partner space.
          </p>
        </div>
      </section>
    </MarketplaceChrome>
  );
}
