import { prisma } from '@/lib/prisma';

/**
 * Fetch a space with its related details for display.
 * Includes amenities, areas (with rates), and weekly availability.
 */
export async function getSpaceDetail(spaceId: bigint) {
  const space = await prisma.space.findUnique({
    where: { space_id: spaceId, },
    include: {
      amenity: { orderBy: { name: 'asc', }, },
      area: {
        orderBy: { name: 'asc', },
        include: {
          price_rate: { orderBy: { rate_id: 'asc', }, },
          image: { orderBy: { display_order: 'asc', }, },
        },
      },
      space_availability: { orderBy: { day_of_week: 'asc', }, },
    },
  });

  if (!space) return null;

  const areaWithAlias = (space.area ?? []).map((area) => ({
    ...area,
    rate_rate_area_idToarea: area.price_rate,
  }));

  return {
    ...space,
    area: areaWithAlias,
  } as typeof space;
}
