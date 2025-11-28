import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

  if (!rooms.length) {
    redirect('/marketplace');
  }

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
