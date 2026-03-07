import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { AdminComplaintsPage } from '@/components/pages/Admin/AdminComplaintsPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Complaints | UpSpace',
  description: 'Review and manage escalated complaints.',
};

export default async function AdminComplaintsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminComplaintsPage />
    </AdminChrome>
  );
}
