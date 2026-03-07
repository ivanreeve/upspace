import type { SpaceRecord } from '@/data/spaces';
import { prisma } from '@/lib/prisma';
import { partnerSpaceInclude, serializePartnerSpace } from '@/lib/spaces/partner-serializer';

export async function getPartnerSpaces(
  userId: bigint
): Promise<SpaceRecord[]> {
  const spaces = await prisma.space.findMany({
    where: { user_id: userId, },
    orderBy: { created_at: 'desc', },
    include: partnerSpaceInclude,
  });

  return Promise.all(spaces.map((space) => serializePartnerSpace(space)));
}
