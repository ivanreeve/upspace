import { cookies } from 'next/headers';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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
      <section className="flex min-h-full w-full flex-col gap-6 py-10 px-4 md:py-12 md:px-8">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Admin dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Portfolio health</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            This dashboard will help you monitor partner activity, prioritize approvals, and stay ahead of occupancy and task notifications.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-dashed border-border/70 bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Occupancy pulse</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Live utilization, booking velocity, and availability trends will be visible here soon.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Coming soon
              </Badge>
              <p className="mt-3">We&apos;re wiring in the metrics that tell you which spaces are growing and when to scale support.</p>
            </CardContent>
          </Card>
          <Card className="border-dashed border-border/70 bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Approvals & tasks</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Track verification queues, overdue actions, and critical alerts from a single glance.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Coming soon
              </Badge>
              <p className="mt-3">We&apos;re surfacing the alerts that matter to partners and admin teams.</p>
            </CardContent>
          </Card>
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
