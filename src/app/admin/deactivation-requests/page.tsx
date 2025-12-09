import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminDeactivationRequestsPage } from '@/components/pages/Admin/AdminDeactivationRequestsPage';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Deactivation Requests | UpSpace',
  description: 'Review and approve user deactivation requests.',
};

export default async function AdminDeactivationRequestsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminDeactivationRequestsPage />
    </AdminChrome>
  );
}
