import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminUnpublishRequestsPage } from '@/components/pages/Admin/AdminUnpublishRequestsPage';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Unpublish Requests | UpSpace',
  description: 'Review partner requests to unpublish spaces.',
};

export default async function AdminUnpublishRequestsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminUnpublishRequestsPage />
    </AdminChrome>
  );
}
