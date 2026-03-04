import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminReportsPage } from '@/components/pages/Admin/AdminReportsPage';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Reports | UpSpace',
  description: 'Analyze marketplace trends and operational health.',
};

export default async function AdminReportsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminReportsPage />
    </AdminChrome>
  );
}
