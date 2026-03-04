import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PartnerTransactionHistory } from '@/components/pages/Transactions/PartnerTransactionHistory';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { prisma } from '@/lib/prisma';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Transaction history | UpSpace',
  description: 'Review wallet transactions tied to your listings.',
};

export default async function PartnerTransactionsPage() {
  const supabase = await createSupabaseReadOnlyServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      role: true,
    },
  });

  if (!dbUser || dbUser.role !== 'partner') {
    redirect('/partner/spaces');
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <PartnerTransactionHistory />
    </SpacesChrome>
  );
}
