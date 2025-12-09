import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SpacesBookingsPage } from '@/components/pages/Spaces/SpacesBookingsPage';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { prisma } from '@/lib/prisma';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Partner Bookings | UpSpace',
  description: 'Track bookings and capacity across your areas.',
};

export default async function SpacesBookingsRoute() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!dbUser || dbUser.role !== 'partner') {
    redirect('/');
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <SpacesBookingsPage />
    </SpacesChrome>
  );
}
