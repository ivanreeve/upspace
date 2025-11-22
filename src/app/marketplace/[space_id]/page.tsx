import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import { getSpaceDetail } from '@/lib/queries/space';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SpaceDetail from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

type Props = { params: { space_id: string } };

const isUuid = (value: string | undefined) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function generateMetadata({ params, }: Props): Promise<Metadata> {
  if (!isUuid(params.space_id)) return { title: 'Space Not Found - UpSpace', };

  const space = await prisma.space.findFirst({
    where: {
      id: params.space_id,
      verification: { some: { status: { in: ['approved', 'in_review'], }, }, },
    },
    select: { name: true, },
  });

  return { title: space ? `${space.name} - UpSpace` : 'Space Not Found - UpSpace', };
}

export default async function SpaceDetailPage({ params, }: Props) {
  if (!isUuid(params.space_id)) notFound();
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
  } = await supabase.auth.getUser();

  const bookmarkUser = authData?.user
    ? await prisma.user.findFirst({
      where: { auth_user_id: authData.user.id, },
      select: { user_id: true, },
    })
    : null;

  const space = await getSpaceDetail(params.space_id, {
    bookmarkUserId: bookmarkUser?.user_id,
  });
  if (!space) notFound();
  return (
    <>
      <NavBar />
      <SpaceDetail space={ space } />
      <Footer />
    </>
  );
}
