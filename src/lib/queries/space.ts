import { prisma } from '@/lib/prisma';

/**
 * Fetch a space with its related details for display.
 * Includes amenities, areas (with rates), and weekly availability.
 */
export async function getSpaceDetail(spaceId: bigint) {
  return prisma.space.findUnique({
    where: { space_id: spaceId, },
    include: {
      amenity: { orderBy: { name: 'asc', }, },
      area: {
        orderBy: { name: 'asc', },
        include: { rate_rate_area_idToarea: { orderBy: { rate_id: 'asc', }, }, },
      },
      space_availability: true,
    },
  });
}
