import type { Prisma } from '@prisma/client';

import {
  AREA_INPUT_DEFAULT,
  type AreaRecord,
  type SpaceImageRecord,
  type SpaceRecord,
  type SpaceStatus,
  type WeekdayName,
  WEEKDAY_ORDER,
  cloneWeeklyAvailability,
  createDefaultWeeklyAvailability
} from '@/data/spaces';

const DAY_INDEX_TO_WEEKDAY: Record<number, WeekdayName> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const padTime = (value: number) => value.toString().padStart(2, '0');
const formatTime = (value: Date) => `${padTime(value.getUTCHours())}:${padTime(value.getUTCMinutes())}`;

export const partnerSpaceInclude = {
  amenity: { select: { amenity_choice_id: true, }, },
  space_availability: { orderBy: { day_of_week: 'asc' as const, }, },
  area: {
    orderBy: { created_at: 'asc' as const, },
    include: { price_rate: { orderBy: { rate_id: 'asc' as const, }, }, },
  },
  space_image: {
    orderBy: { display_order: 'asc' as const, },
    select: {
      image_id: true,
      path: true,
      category: true,
      is_primary: true,
      display_order: true,
    },
  },
  verification: {
    orderBy: { created_at: 'desc' as const, },
    take: 1,
    select: { status: true, },
  },
} satisfies Prisma.spaceInclude;

export type PartnerSpaceRow = Prisma.spaceGetPayload<{
  include: typeof partnerSpaceInclude;
}>;

export function serializePartnerSpace(space: PartnerSpaceRow): SpaceRecord {
  return {
    id: space.space_id.toString(),
    name: space.name,
    description: space.description ?? '',
    unit_number: space.unit_number,
    address_subunit: space.address_subunit,
    street: space.street,
    barangay: space.barangay ?? '',
    city: space.city,
    region: space.region,
    postal_code: space.postal_code,
    country_code: space.country_code,
    lat: Number(space.lat),
    long: Number(space.long),
    amenities: space.amenity.map((entry) => entry.amenity_choice_id),
    availability: buildAvailability(space.space_availability),
    status: deriveSpaceStatus(space),
    created_at: space.created_at instanceof Date ? space.created_at.toISOString() : String(space.created_at),
    areas: space.area.map(serializeArea),
    images: space.space_image.map(serializeImage),
  };
}

const buildAvailability = (
  rows: PartnerSpaceRow['space_availability']
): SpaceRecord['availability'] => {
  const availability = cloneWeeklyAvailability(createDefaultWeeklyAvailability());
  for (const day of WEEKDAY_ORDER) {
    availability[day] = {
      ...availability[day],
      is_open: false,
    };
  }

  for (const record of rows) {
    const day = DAY_INDEX_TO_WEEKDAY[record.day_of_week];
    if (!day) {
      continue;
    }

    availability[day] = {
      is_open: true,
      opens_at: formatTime(new Date(record.opening)),
      closes_at: formatTime(new Date(record.closing)),
    };
  }

  return availability;
};

export const serializeArea = (
  area: PartnerSpaceRow['area'][number]
): AreaRecord => {
  const primaryRate = area.price_rate[0];
  return {
    id: area.area_id.toString(),
    name: area.name,
    min_capacity: Number(area.min_capacity),
    max_capacity: Number(area.max_capacity),
    rate_time_unit: (primaryRate?.time_unit as AreaRecord['rate_time_unit']) ?? AREA_INPUT_DEFAULT.rate_time_unit,
    rate_amount: primaryRate ? Number(primaryRate.price) : AREA_INPUT_DEFAULT.rate_amount,
    created_at: area.created_at instanceof Date ? area.created_at.toISOString() : String(area.created_at),
  };
};

const serializeImage = (
  image: PartnerSpaceRow['space_image'][number]
): SpaceImageRecord => ({
  id: image.image_id.toString(),
  path: image.path,
  category: image.category,
  is_primary: Boolean(image.is_primary),
  display_order: Number(image.display_order ?? 0),
});

const deriveSpaceStatus = (space: PartnerSpaceRow): SpaceStatus => {
  const latest = space.verification[0]?.status;
  if (latest === 'approved') {
    return 'Live';
  }
  if (latest === 'in_review') {
    return 'Pending';
  }
  return 'Draft';
};
