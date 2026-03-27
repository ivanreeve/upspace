import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { AdminReconciliationPage } from '@/components/pages/Admin/AdminReconciliationPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Reconciliation | UpSpace',
  description: 'Review provider-backed wallet sync health and reconcile pending payouts.',
};

export default async function AdminReconciliationRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminReconciliationPage />
    </AdminChrome>
  );
}
