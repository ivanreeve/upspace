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
import { buildPublicObjectUrl, isAbsoluteUrl, resolveSignedImageUrls } from '@/lib/spaces/image-urls';

const DAY_INDEX_TO_WEEKDAY: Record<number, WeekdayName> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
};

const padTime = (value: number) => value.toString().padStart(2, '0');
const formatTime = (value: Date) => `${padTime(value.getUTCHours())}:${padTime(value.getUTCMinutes())}`;

export const partnerSpaceInclude = {
  amenity: {
    select: {
      amenity_choice_id: true,
      amenity_choice: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
  },
  space_availability: { orderBy: { day_of_week: 'asc' as const, }, },
  area: {
    orderBy: { created_at: 'asc' as const, },
    include: { price_rate: { orderBy: { created_at: 'asc' as const, }, }, },
  },
  space_image: {
    orderBy: { display_order: 'asc' as const, },
    select: {
      id: true,
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
  user: {
    select: {
      first_name: true,
      last_name: true,
      handle: true,
    },
  },
} satisfies Prisma.spaceInclude;

export type PartnerSpaceRow = Prisma.spaceGetPayload<{
  include: typeof partnerSpaceInclude;
}>;

export async function serializePartnerSpace(space: PartnerSpaceRow): Promise<SpaceRecord> {
  return {
    id: space.id,
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
    images: await buildImageRecords(space.space_image),
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
    id: area.id,
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
): Omit<SpaceImageRecord, 'public_url'> => ({
  id: image.id,
  path: image.path,
  category: image.category,
  is_primary: Boolean(image.is_primary),
  display_order: Number(image.display_order ?? 0),
});

type VerificationContainer = {
  verification: { status: Prisma.verificationStatus }[];
};

export const deriveSpaceStatus = (space: VerificationContainer): SpaceStatus => {
  const latest = space.verification[0]?.status;
  if (latest === 'approved') {
    return 'Live';
  }
  if (latest === 'in_review') {
    return 'Pending';
  }
  return 'Draft';
};

async function buildImageRecords(images: PartnerSpaceRow['space_image']): Promise<SpaceImageRecord[]> {
  if (!images.length) {
    return [];
  }

  const signedUrlMap = await resolveSignedImageUrls(images);

  return images.map((image) => {
    const serialized = serializeImage(image);
    const directUrl = isAbsoluteUrl(serialized.path) ? serialized.path : null;
    const signedOrDirectUrl = directUrl ?? signedUrlMap.get(serialized.path) ?? null;
    return {
      ...serialized,
      public_url: signedOrDirectUrl ?? buildPublicObjectUrl(serialized.path),
    };
  });
}
