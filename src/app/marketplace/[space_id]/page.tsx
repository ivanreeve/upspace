import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import { getSpaceDetail } from '@/lib/queries/space';
import MarketplaceSpaceDetail from '@/components/pages/Marketplace/SpaceDetail/Marketplace.SpaceDetail';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

type Props = { params: { space_id: string } };

export async function generateMetadata({ params, }: Props): Promise<Metadata> {
  if (!/^\d+$/.test(params.space_id)) return { title: 'Space Not Found - UpSpace', };
  const space = await prisma.space.findUnique({
    where: { space_id: BigInt(params.space_id), },
    select: { name: true, },
  });
  return { title: space ? `${space.name} - UpSpace` : 'Space Not Found - UpSpace', };
}

export default async function SpaceDetailPage({ params, }: Props) {
  if (!/^\d+$/.test(params.space_id)) notFound();
  const spaceId = BigInt(params.space_id);
  const space = await getSpaceDetail(spaceId);
  if (!space) notFound();
  return (
    <>
      <NavBar />
      <MarketplaceSpaceDetail space={ space as any } />
      <Footer />
    </>
  );
}
