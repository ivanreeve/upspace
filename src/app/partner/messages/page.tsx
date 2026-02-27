import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
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
        <div className="max-w-md space-y-6 rounded-3xl border border-border/40 bg-card p-10 text-center shadow-lg shadow-black/5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-10 w-10 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={ 2 }
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              No customer chats yet
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Customers will land here as soon as they send a message about your spaces.
              Keep your listings updated to spark new conversations.
            </p>
          </div>
          <Button asChild size="lg" className="w-full text-white bg-primary hover:bg-primary/90 font-medium rounded-xl">
            <Link href="/partner/spaces">
              View your spaces
            </Link>
          </Button>
        </div>
      </div>
    </SpacesChrome>
  );
}
