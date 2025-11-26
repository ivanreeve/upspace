import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import AdminPage from '@/components/pages/Admin/AdminPage';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Dashboard | UpSpace',
  description: 'Manage space verifications and platform administration.',
};

export default async function AdminRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminPage />
    </AdminChrome>
  );
}
