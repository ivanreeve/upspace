'use client';

import { AdminVerificationsTable } from './AdminPage.VerificationsTable';

export default function AdminPage() {
  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Verification Queue
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Review and approve space verification requests from partners.
          </p>
        </div>
        <AdminVerificationsTable />
      </section>
    </div>
  );
}
