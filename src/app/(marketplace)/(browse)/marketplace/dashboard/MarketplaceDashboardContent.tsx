'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { PartnerMessagesPanel } from '@/components/pages/Marketplace/PartnerMessagesPanel';
import { useUserProfile } from '@/hooks/use-user-profile';

export function MarketplaceDashboardContent() {
  const {
 data: profile, isLoading, isError, 
} = useUserProfile();

  if (isError) {
    return (
      <section className="space-y-6 py-8">
        <div className="rounded-md border border-destructive/70 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Unable to determine your dashboard access. Try refreshing the page.
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="space-y-6 py-8 md:space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[220px]" />
          <Skeleton className="h-4 w-[320px]" />
        </div>
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="space-y-6 py-8">
        <div className="rounded-md border border-destructive/50 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          Unable to load your profile. Please refresh the page.
        </div>
      </section>
    );
  }

  if (profile.role === 'admin') {
    return (
      <section className="space-y-6 py-8">
        <div className="rounded-md border border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          Admin dashboards now live at <span className="font-medium">/admin/dashboard</span>.
        </div>
      </section>
    );
  }

  return <PartnerMessagesPanel />;
}
