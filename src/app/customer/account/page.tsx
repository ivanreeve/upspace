import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { createSupabaseReadOnlyServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Account | UpSpace',
  description: 'Edit your Upspace profile details and primary role.',
};

export default async function AccountRoutePage() {
  const supabase = await createSupabaseReadOnlyServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect('/');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!dbUser) {
    redirect('/');
  }

  if (dbUser.role === 'partner') {
    redirect('/partner/settings');
  }

  redirect('/customer/settings');
}
