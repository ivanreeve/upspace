'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AdminDashboard } from '@/components/pages/Admin/AdminDashboard';
import { PartnerMessagesPanel } from '@/components/pages/Marketplace/PartnerMessagesPanel';
import { mockAdminDashboardPayload } from '@/data/admin-dashboard-mock';
import { useUserProfile } from '@/hooks/use-user-profile';

export function MarketplaceDashboardContent() {
  const { data: profile, isLoading, isError } = useUserProfile();

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
      <section className="space-y-5 py-8 md:space-y-6 md:py-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[32px]">
            Admin dashboard
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Unified audit log for bookings, coworking spaces, client registrations, and partner verifications.
          </p>
          <p className="text-xs text-muted-foreground">
            The preview renders a representative dataset so you can evaluate layout density immediately.
          </p>
        </header>
        <AdminDashboard mockPayload={mockAdminDashboardPayload} />
      </section>
    );
  }

  return <PartnerMessagesPanel />;
}
