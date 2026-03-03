import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import AccountPage from '@/components/pages/Account/AccountPage';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { prisma } from '@/lib/prisma';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Partner Account | UpSpace',
  description: 'Edit your UpSpace partner profile details and primary role.',
};

export default async function PartnerAccountRoutePage() {
  const supabase = await createSupabaseReadOnlyServerClient();
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
      <AccountPage />
    </SpacesChrome>
  );
}
