import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { AdminChatReportsPage } from '@/components/pages/Admin/AdminChatReportsPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Chat Reports | UpSpace',
  description: 'Monitor and manage reports submitted from message conversations.',
};

export default async function AdminChatReportsRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminChatReportsPage />
    </AdminChrome>
  );
}
