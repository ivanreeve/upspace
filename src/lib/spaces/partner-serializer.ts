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
import type { PriceRuleDefinition, PriceRuleRecord } from '@/lib/pricing-rules';

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
    include: { price_rule: true, },
  },
  price_rule: { orderBy: { created_at: 'asc' as const, }, },
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
    pricing_rules: space.price_rule.map(serializePriceRule),
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

const serializePriceRule = (
  rule: PartnerSpaceRow['price_rule'][number]
): PriceRuleRecord => ({
  id: rule.id,
  name: rule.name,
  description: rule.description ?? null,
  definition: rule.definition as PriceRuleDefinition,
  created_at: rule.created_at instanceof Date ? rule.created_at.toISOString() : String(rule.created_at),
  updated_at: rule.updated_at instanceof Date ? rule.updated_at.toISOString() : null,
});

export const serializeArea = (
  area: PartnerSpaceRow['area'][number]
): AreaRecord => {
  return {
    id: area.id,
    name: area.name,
    max_capacity: Number(area.max_capacity ?? AREA_INPUT_DEFAULT.max_capacity),
    automatic_booking_enabled: Boolean(area.automatic_booking_enabled),
    request_approval_at_capacity: Boolean(area.request_approval_at_capacity),
    advance_booking_enabled: Boolean(area.advance_booking_enabled),
    advance_booking_value: area.advance_booking_value ?? null,
    advance_booking_unit: (area.advance_booking_unit as AreaRecord['advance_booking_unit']) ?? null,
    booking_notes_enabled: Boolean(area.booking_notes_enabled),
    booking_notes: area.booking_notes ?? null,
    created_at: area.created_at instanceof Date ? area.created_at.toISOString() : String(area.created_at),
    price_rule: area.price_rule ? serializePriceRule(area.price_rule) : null,
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

type VerificationLike =
  | {
    verification: { status: Prisma.verificationStatus | null }[];
  }
  | Prisma.verificationStatus
  | null
  | undefined;

export const deriveSpaceStatus = (source: VerificationLike): SpaceStatus => {
  const latest = typeof source === 'string' || source === null || source === undefined
    ? source ?? null
    : source.verification[0]?.status ?? null;
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
