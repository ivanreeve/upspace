import React from 'react';

import { AdminDashboard } from './AdminDashboard';

export function AdminDashboardPage() {
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
          Live operational data from recent records, metrics, and audit events.
        </p>
      </header>
      <AdminDashboard />
    </section>
  );
}
