import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminSpacesPage } from '@/components/pages/Admin/AdminSpacesPage';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Spaces | UpSpace',
  description: 'Browse and hide spaces from the admin console.',
};

export default async function AdminSpacesRoute() {
  const cookieStore = await cookies();
  const initialSidebarOpen = parseSidebarState(cookieStore.get(SIDEBAR_STATE_COOKIE)?.value);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminSpacesPage />
    </AdminChrome>
  );
}
