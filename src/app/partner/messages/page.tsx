import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Partner Messages | UpSpace',
  description: 'Browse customer conversations and open a dedicated chat thread.',
};

export default async function SpacesMessagesPage() {
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

  if (!dbUser || dbUser.role !== 'partner') {
    redirect('/');
  }

  const rooms = await prisma.chat_room.findMany({
    where: { space: { user_id: dbUser.user_id, }, },
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

    redirect(`/partner/messages/${sorted[0]?.id}`);
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome
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
            No customer chats yet
          </h1>
          <p className="text-sm text-muted-foreground">
            Customers will land here as soon as they send a message about your spaces.
            Keep your listings updated to spark new conversations.
          </p>
          <Button asChild variant="secondary" className="mt-2 text-white hover:bg-[#0A5057]">
            <Link href="/partner/spaces">
              View your spaces
            </Link>
          </Button>
        </div>
      </div>
    </SpacesChrome>
  );
}
