import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Bookmarks } from '@/components/pages/Bookmarks/Bookmarks';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Bookmarks | UpSpace',
  description: 'Revisit and manage your saved coworking spaces.',
};

export default async function BookmarksPage() {
  const supabase = await createSupabaseServerClient();
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

  if (!dbUser || dbUser.role !== 'customer') {
    redirect('/');
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <Bookmarks bookmarkUserId={ dbUser.user_id.toString() } />
    </MarketplaceChrome>
  );
}
