import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { AdminPayoutRequestsPage } from '@/components/pages/Admin/AdminPayoutRequestsPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Payout Requests | UpSpace',
  description: 'Review and resolve partner payout requests.',
};

export default async function AdminPayoutRequestsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminPayoutRequestsPage />
    </AdminChrome>
  );
}
