import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminUsersPage } from '@/components/pages/Admin/AdminUsersPage';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Users | UpSpace',
  description: 'Search and manage users from the admin console.',
};

export default async function AdminUsersRoute() {
  const cookieStore = await cookies();
  const initialSidebarOpen = parseSidebarState(cookieStore.get(SIDEBAR_STATE_COOKIE)?.value);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminUsersPage />
    </AdminChrome>
  );
}
