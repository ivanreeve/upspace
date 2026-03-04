import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { AdminDashboardPage } from '@/components/pages/Admin/AdminDashboardPage';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: 'Admin Dashboard | UpSpace',
  description: 'Unified audit log spanning bookings, coworking spaces, client registrations, and partner verifications.',
};

export default async function AdminDashboardRoute() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <AdminChrome initialSidebarOpen={ initialSidebarOpen }>
      <AdminDashboardPage />
    </AdminChrome>
  );
}
