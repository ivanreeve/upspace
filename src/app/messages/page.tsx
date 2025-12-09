import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Messages | UpSpace',
  description: 'Browse every space conversation and jump into a dedicated thread.',
};

export default async function CustomerMessagesPage() {
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

    redirect(`/messages/${sorted[0]?.id}`);
  }

  const cookieStore = cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      insetStyle={ {
        height: '100svh',
        overflow: 'hidden',
        marginTop: 0,
        marginBottom: 0,
        paddingBottom: 'calc(1rem + var(--safe-area-bottom))',
      } }
    >
      <div className="flex h-full w-full items-center justify-center px-4 py-8">
        <div className="max-w-xl space-y-4 rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Messages
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            No conversations yet
          </h1>
          <p className="text-sm text-muted-foreground">
            Start a chat from any space listing to keep the conversation going.
            Once someone replies, your inbox will show up here.
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/marketplace">
              Browse spaces
            </Link>
          </Button>
        </div>
      </div>
    </MarketplaceChrome>
  );
}
