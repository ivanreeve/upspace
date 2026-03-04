import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { FiMessageCircle } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { CustomerChatRoomView } from '@/components/pages/Marketplace/CustomerChatRoomView';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Messages | UpSpace',
  description: 'Browse every space conversation and jump into a dedicated thread.',
};

export default async function CustomerMessagesPage() {
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

  if (!dbUser || dbUser.role !== 'customer') {
    redirect('/');
  }

  const rooms = await prisma.chat_room.findMany({
    where: { customer_id: dbUser.user_id, },
    include: {
      chat_message: {
        orderBy: { created_at: 'desc', },
        take: 1,
      },
    },
  });

  if (rooms.length) {
    const sorted = rooms.sort((a, b) => {
      const aKey = a.chat_message[0]?.created_at ?? a.created_at;
      const bKey = b.chat_message[0]?.created_at ?? b.created_at;
      if (aKey === bKey) {
        return 0;
      }
      return aKey > bKey ? -1 : 1;
    });

    redirect(`/customer/messages/${sorted[0]?.id}`);
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      insetClassName="!px-0 !md:px-0 !py-0"
      insetStyle={ {
        height: '100svh',
        overflow: 'hidden',
        marginTop: 0,
        marginBottom: 0,
        paddingBottom: 'var(--safe-area-bottom)',
      } }
    >
      <div className="flex h-full w-full flex-col overflow-hidden p-0">
        { rooms.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <FiMessageCircle className="size-10 text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-sm text-muted-foreground">
                Start a conversation by visiting a space and messaging the host.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/marketplace">Browse spaces</Link>
            </Button>
          </div>
        ) : (
          <CustomerChatRoomView />
        ) }
      </div>
    </MarketplaceChrome>
  );
}
