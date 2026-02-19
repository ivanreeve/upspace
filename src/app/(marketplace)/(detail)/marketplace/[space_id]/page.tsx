import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import { getSpaceDetail } from '@/lib/queries/space';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SpaceDetail from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail';
import { SpaceDetailSkeleton } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail.Skeleton';
import { SpaceDetailShell } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetailShell';
import { MarketplaceErrorState } from '@/components/pages/Marketplace/Marketplace.ErrorState';

type Params = { space_id: string };
type Props = { params: Promise<Params> };

const isUuid = (value: string | undefined) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function generateMetadata({ params, }: Props): Promise<Metadata> {
  const { space_id, } = await params;
  if (!isUuid(space_id)) return { title: 'Space Not Found - UpSpace', };

  try {
    const space = await prisma.space.findFirst({
      where: {
        id: space_id,
        verification: { some: { status: { in: ['approved', 'in_review'], }, }, },
        is_published: true,
      },
      select: { name: true, },
    });

    return { title: space ? `${space.name} - UpSpace` : 'Space Not Found - UpSpace', };
  } catch (error) {
    console.error('Failed to build metadata for marketplace space detail', error);
    return { title: 'Space - UpSpace', };
  }
}

export default async function SpaceDetailPage({ params, }: Props) {
  const { space_id, } = await params;
  if (!isUuid(space_id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: authData, } = await supabase.auth.getUser();

  // Fetch bookmark user and space in parallel
  const bookmarkUserPromise = authData?.user
    ? prisma.user.findFirst({
      where: { auth_user_id: authData.user.id, },
      select: { user_id: true, },
    })
    : Promise.resolve(null);

  let space: Awaited<ReturnType<typeof getSpaceDetail>> = null;
  let spaceLoadFailed = false;

  try {
    const [bookmarkUser, spaceResult] = await Promise.all([
      bookmarkUserPromise,
      getSpaceDetail(space_id, { bookmarkUserId: undefined, })
    ]);

    // If we have a bookmark user, re-fetch with bookmark info
    // This is a tradeoff - we get faster initial load but may need a second query
    if (bookmarkUser?.user_id && spaceResult) {
      space = await getSpaceDetail(space_id, { bookmarkUserId: bookmarkUser.user_id, });
    } else {
      space = spaceResult;
    }
  } catch (error) {
    spaceLoadFailed = true;
    console.error('Failed to fetch marketplace space detail', error);
  }

  if (!space && !spaceLoadFailed) {
    notFound();
  }

  if (!space) {
    return (
      <SpaceDetailShell>
        <div className="bg-background">
          <div className="mx-auto max-w-[1100px] px-4 py-16">
            <MarketplaceErrorState />
          </div>
        </div>
      </SpaceDetailShell>
    );
  }
  return (
    <SpaceDetailShell>
      <Suspense fallback={ <SpaceDetailSkeleton /> }>
        <SpaceDetail space={ space } />
      </Suspense>
    </SpaceDetailShell>
  );
}
