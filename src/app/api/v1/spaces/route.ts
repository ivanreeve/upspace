import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { WEEKDAY_ORDER, type WeekdayName } from '@/data/spaces';
import { prisma } from '@/lib/prisma';
import { updateSpaceLocationPoint } from '@/lib/spaces/location';
import { richTextPlainTextLength, sanitizeRichText } from '@/lib/rich-text';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// JSON-safe replacer: BigInt->string, Date->ISO
const replacer = (_k: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString()
  : v instanceof Date ? v.toISOString()
  : v;

const TIME_24H_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MIN_DESCRIPTION_CHARS = 20;
const MAX_DESCRIPTION_CHARS = 500;

const weekdayEnum = z.enum(WEEKDAY_ORDER);

const timeStringToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? hours * 60 + minutes
    : Number.NaN;
};

const timeStringToUtcDate = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
};

const daySlotSchema = z.object({
  is_open: z.boolean(),
  opens_at: z.string().regex(TIME_24H_PATTERN, 'Use 24-hour HH:MM format.'),
  closes_at: z.string().regex(TIME_24H_PATTERN, 'Use 24-hour HH:MM format.'),
}).superRefine((values, ctx) => {
  if (!values.is_open) {
    return;
  }

  const openMinutes = timeStringToMinutes(values.opens_at);
  const closeMinutes = timeStringToMinutes(values.closes_at);

  if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter valid HH:MM times.',
    });
    return;
  }

  if (closeMinutes <= openMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['closes_at'],
      message: 'Closing time must be after opening time.',
    });
  }
});

const weeklyAvailabilitySchema = z.record(weekdayEnum, daySlotSchema).superRefine((availability, ctx) => {
  let openDayCount = 0;

  for (const day of WEEKDAY_ORDER) {
    const slot = availability[day];
    if (!slot) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [day],
        message: `Provide hours for ${day}.`,
      });
      continue;
    }

    if (slot.is_open) {
      openDayCount += 1;
    }
  }

  if (openDayCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Open the space on at least one day of the week.',
    });
  }
});

const optionalLocationField = z
  .string()
  .max(200)
  .optional()
  .transform((value) => (value ?? '').trim());

const coordinateSchema = z
  .coerce
  .number()
  .refine((value) => Number.isFinite(value), { message: 'Coordinate is required.', });

const spaceImageSchema = z.object({
  path: z.string().trim().min(1).max(1024),
  category: z.string().trim().min(1).max(200).optional(),
  is_primary: z.boolean(),
  display_order: z.number().int().min(0).max(10_000),
});

const VERIFICATION_REQUIREMENT_IDS = ['dti_registration', 'tax_registration', 'representative_id'] as const;

const verificationDocumentSchema = z.object({
  path: z.string().trim().min(1).max(1024),
  requirement_id: z.enum(VERIFICATION_REQUIREMENT_IDS),
  slot_id: z.string().trim().min(1).max(100).optional(),
  mime_type: z.string().trim().min(1).max(255),
  file_size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
});

const spaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().min(1),
  unit_number: optionalLocationField,
  address_subunit: optionalLocationField,
  street: z.string().trim().min(1).max(200),
  barangay: z.string().max(200).optional().transform((value) => value?.trim() ?? ''),
  city: z.string().trim().min(1).max(200),
  region: z.string().trim().min(1).max(200),
  postal_code: z.string().trim().length(4).regex(/^[0-9]{4}$/),
  country_code: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  lat: coordinateSchema.min(-90).max(90),
  long: coordinateSchema.min(-180).max(180),
  amenities: z.array(z.string().uuid()).min(2),
  availability: weeklyAvailabilitySchema,
  images: z.array(spaceImageSchema).max(50).optional(),
  verification_documents: z.array(verificationDocumentSchema).max(20).optional(),
});

type SpaceCreateInput = z.infer<typeof spaceCreateSchema>;

type VerificationRequirementId = (typeof VERIFICATION_REQUIREMENT_IDS)[number];

const REQUIREMENT_TO_DOCUMENT_TYPE: Record<VerificationRequirementId, 'dti_registration' | 'bir_cor' | 'authorized_rep_id'> = {
  dti_registration: 'dti_registration',
  tax_registration: 'bir_cor',
  representative_id: 'authorized_rep_id',
};

type AvailabilitySlot = {
  day: WeekdayName;
  dayIndex: number;
  opening: Date;
  closing: Date;
};

const DAY_NAME_TO_INDEX: Record<WeekdayName, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

const padTime = (value: number) => value.toString().padStart(2, '0');
const formatTime = (value: Date) => `${padTime(value.getUTCHours())}:${padTime(value.getUTCMinutes())}`;
const SUPABASE_DEFAULT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dfnwebbpjajrlfmeaarx.supabase.co';
const SUPABASE_BASE_URL = SUPABASE_DEFAULT_URL.replace(/\/$/, '');
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const isAbsoluteUrl = (value: string | null | undefined) => Boolean(value && /^https?:\/\//i.test(value));
const buildPublicObjectUrl = (path: string | null | undefined) => {
  if (!path) {
    return null;
  }
  if (isAbsoluteUrl(path)) {
    return path;
  }
  const normalized = path.replace(/^\/+/, '');
  if (!SUPABASE_BASE_URL) {
    return null;
  }
  return `${SUPABASE_BASE_URL}/storage/v1/object/public/${normalized}`;
};

type StoragePathParts = {
  bucket: string;
  objectPath: string;
  fullPath: string;
};

const parseStoragePath = (path: string | null | undefined): StoragePathParts | null => {
  if (!path || isAbsoluteUrl(path)) {
    return null;
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const [bucket, ...objectParts] = segments;
  if (!bucket || objectParts.length === 0) {
    return null;
  }

  return {
    bucket,
    objectPath: objectParts.join('/'),
    fullPath: path,
  };
};

const resolveSignedImageUrls = async (
  images: { path: string | null }[]
): Promise<Map<string, string>> => {
  const urlMap = new Map<string, string>();
  if (!images.length) {
    return urlMap;
  }

  const candidates = images
    .map((image) => parseStoragePath(image.path))
    .filter((value): value is StoragePathParts => Boolean(value));

  if (!candidates.length) {
    return urlMap;
  }

  let adminClient;
  try {
    adminClient = getSupabaseAdminClient();
  } catch (error) {
    console.error('Failed to initialize Supabase admin client for signed URLs.', error);
    return urlMap;
  }

  const bucketGroups = candidates.reduce((group, entry) => {
    const collection = group.get(entry.bucket) ?? [];
    collection.push(entry);
    group.set(entry.bucket, collection);
    return group;
  }, new Map<string, StoragePathParts[]>());

  for (const [bucket, entries] of bucketGroups) {
    try {
      const {
        data,
        error,
      } = await adminClient.storage.from(bucket).createSignedUrls(
        entries.map((entry) => entry.objectPath),
        SIGNED_URL_TTL_SECONDS
      );

      if (error || !data) {
        console.error(`Failed to create signed URLs for bucket ${bucket}.`, error);
        continue;
      }

      data.forEach((result, index) => {
        if (!result || result.error || !result.signedUrl) {
          return;
        }
        const source = entries[index];
        if (source) {
          urlMap.set(source.fullPath, result.signedUrl);
        }
      });
    } catch (error) {
      console.error(`Unable to create signed URLs for bucket ${bucket}.`, error);
    }
  }

  return urlMap;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const deriveSpaceStatus = (latestStatus?: Prisma.verificationStatus | null) => {
  if (latestStatus === 'approved') {
    return 'Live';
  }
  if (latestStatus === 'in_review') {
    return 'Pending';
  }
  return 'Draft';
};

const summarizeRates = (
  areas: {
    price_rate: {
      price: Prisma.Decimal | number;
      time_unit: string;
    }[];
  }[]
) => {
  const allRates = areas.flatMap((area) => area.price_rate ?? []);
  if (!allRates.length) {
    return null;
  }
  const numericPrices = allRates.map((rate) => Number(rate.price));
  return {
    min: Math.min(...numericPrices),
    max: Math.max(...numericPrices),
    unit: allRates[0]?.time_unit ?? null,
  };
};

const serializeAvailabilitySlots = (
  slots: {
    day_of_week: number;
    opening: Date;
    closing: Date;
  }[]
) => slots.map((slot) => ({
  day_of_week: slot.day_of_week,
  opens_at: formatTime(new Date(slot.opening)),
  closes_at: formatTime(new Date(slot.closing)),
}));

const normalizeAvailability = (availability: SpaceCreateInput['availability']): AvailabilitySlot[] => {
  const slots: AvailabilitySlot[] = [];

  for (const day of WEEKDAY_ORDER) {
    const slot = availability[day];
    if (!slot || !slot.is_open) {
      continue;
    }

    const opening = timeStringToUtcDate(slot.opens_at);
    const closing = timeStringToUtcDate(slot.closes_at);

    if (closing <= opening) {
      throw new HttpError(422, `Closing time must be after opening time on ${day}.`);
    }

    slots.push({
      day,
      dayIndex: DAY_NAME_TO_INDEX[day],
      opening,
      closing,
    });
  }

  if (!slots.length) {
    throw new HttpError(422, 'Provide availability for at least one day.');
  }

  return slots;
};

const serializeSpace = (space: {
  id: string;
  user_id: bigint;
  name: string;
  unit_number: string;
  street: string;
  address_subunit: string;
  city: string;
  region: string;
  country_code: string;
  postal_code: string;
  description: string | null;
  barangay: string | null;
  lat: Prisma.Decimal | number;
  long: Prisma.Decimal | number;
  created_at: Date;
  updated_at: Date;
}) => ({
  space_id: space.id,
  user_id: space.user_id.toString(),
  name: space.name,
  unit_number: space.unit_number,
  street: space.street,
  address_subunit: space.address_subunit,
  city: space.city,
  region: space.region,
  country_code: space.country_code,
  postal_code: space.postal_code,
  description: space.description ?? '',
  barangay: space.barangay,
  lat: typeof space.lat === 'number' ? space.lat : Number(space.lat),
  long: typeof space.long === 'number' ? space.long : Number(space.long),
  created_at: space.created_at.toISOString(),
  updated_at: space.updated_at.toISOString(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams, } = new URL(req.url);

    // Validate and normalize query params
    const querySchema = z.object({
      // pagination
      limit: z.coerce.number().int().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),

      // simple equals filters
      city: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
      postal_code: z.string().min(1).optional(),
      barangay: z.string().min(1).optional(),
      street: z.string().min(1).optional(),
      user_id: z.string().regex(/^\d+$/).optional(),

      // search
      q: z.string().min(1).optional(),

      // date ranges (RFC3339/ISO-8601)
      created_from: z.string().datetime().optional(),
      created_to: z.string().datetime().optional(),
      updated_from: z.string().datetime().optional(),
      updated_to: z.string().datetime().optional(),

      // ids filter
      space_ids: z.string().optional(), // comma-separated UUIDs

      // relational filters
      amenities: z.string().optional(), // comma-separated list of names
      amenities_mode: z.enum(['all', 'any']).optional(),
      min_capacity: z.coerce.number().int().min(0).optional(),
      bookmark_user_id: z.string().regex(/^\d+$/).optional(),
      available_days: z.string().optional(), // comma-separated day_of_week

      // rate-based filters through areas->rates
      rate_time_unit: z.string().min(1).optional(),
      min_rate_price: z.coerce.number().nonnegative().optional(),
      max_rate_price: z.coerce.number().nonnegative().optional(),
      available_from: z.string().regex(TIME_24H_PATTERN).optional(),
      available_to: z.string().regex(TIME_24H_PATTERN).optional(),
      include_pending: z.coerce.boolean().optional().default(false),

      // sorting
      sort: z.enum(['id','name','created_at','updated_at']).optional(),
      order: z.enum(['asc','desc']).optional(),
    });

    const parsed = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      city: searchParams.get('city') ?? undefined,
      region: searchParams.get('region') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      postal_code: searchParams.get('postal_code') ?? undefined,
      barangay: searchParams.get('barangay') ?? undefined,
      street: searchParams.get('street') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      created_from: searchParams.get('created_from') ?? undefined,
      created_to: searchParams.get('created_to') ?? undefined,
      updated_from: searchParams.get('updated_from') ?? undefined,
      updated_to: searchParams.get('updated_to') ?? undefined,
      space_ids: searchParams.get('space_ids') ?? undefined,
      amenities: searchParams.get('amenities') ?? undefined,
      amenities_mode: searchParams.get('amenities_mode') ?? undefined,
      min_capacity: searchParams.get('min_capacity') ?? undefined,
      bookmark_user_id: searchParams.get('bookmark_user_id') ?? undefined,
      available_days: searchParams.get('available_days') ?? undefined,
      rate_time_unit: searchParams.get('rate_time_unit') ?? undefined,
      min_rate_price: searchParams.get('min_rate_price') ?? undefined,
      max_rate_price: searchParams.get('max_rate_price') ?? undefined,
      available_from: searchParams.get('available_from') ?? undefined,
      available_to: searchParams.get('available_to') ?? undefined,
      include_pending: searchParams.get('include_pending') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const {
      limit,
      cursor,
      city,
      region,
      country,
      postal_code,
      barangay,
      street,
      user_id,
      q,
      created_from,
      created_to,
      updated_from,
      updated_to,
      space_ids,
      amenities,
      amenities_mode,
      min_capacity,
      bookmark_user_id,
      available_days,
      rate_time_unit,
      min_rate_price,
      max_rate_price,
      available_from,
      available_to,
      include_pending,
      sort,
      order,
    } = parsed.data;

    if (available_from && available_to) {
      const startMinutes = timeStringToMinutes(available_from);
      const endMinutes = timeStringToMinutes(available_to);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
        return NextResponse.json(
          { error: 'available_to must be later than available_from.', },
          { status: 400, }
        );
      }
    }

    // Build Prisma where clause
    const and: any[] = [];
    if (city) and.push({ city, });
    if (region) and.push({ region, });
    if (country) and.push({ country_code: country, });
    if (postal_code) and.push({ postal_code, });
    if (barangay) and.push({ barangay, });
    if (street) and.push({ street, });
    if (user_id) and.push({ user_id: BigInt(user_id), });

    if (q) {
      and.push({
        OR: [
          {
 name: {
 contains: q,
mode: 'insensitive' as const, 
}, 
},
          {
 street: {
 contains: q,
mode: 'insensitive' as const, 
}, 
},
          {
 address_subunit: {
 contains: q,
mode: 'insensitive' as const, 
}, 
},
          {
 unit_number: {
 contains: q,
mode: 'insensitive' as const, 
}, 
},
          {
 city: {
 contains: q,
mode: 'insensitive' as const, 
}, 
},
          {
 region: {
 contains: q,
mode: 'insensitive' as const, 
}, 
},
          {
            country_code: {
              contains: q,
              mode: 'insensitive' as const,
            },
          },
          {
 postal_code: {
 contains: q,
mode: 'insensitive' as const, 
}, 
}
        ],
      });
    }

    // Space IDs filter
    const candidateSpaceIds = (space_ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (candidateSpaceIds.length > 0) {
      try {
        candidateSpaceIds.forEach((value) => z.string().uuid().parse(value));
      } catch {
        return NextResponse.json(
          { error: 'space_ids must be a comma-separated list of UUIDs', },
          { status: 400, }
        );
      }
      and.push({ id: { in: candidateSpaceIds, }, });
    }

    const verificationStatuses: Prisma.verificationStatus[] = include_pending
      ? ['approved', 'in_review']
      : ['approved'];

    and.push({ verification: { some: { status: { in: verificationStatuses, }, }, }, });

    // Created/updated range filters
    if (created_from || created_to) {
      const created: any = {};
      if (created_from) created.gte = new Date(created_from);
      if (created_to) created.lte = new Date(created_to);
      and.push({ created_at: created, });
    }
    if (updated_from || updated_to) {
      const updated: any = {};
      if (updated_from) updated.gte = new Date(updated_from);
      if (updated_to) updated.lte = new Date(updated_to);
      and.push({ updated_at: updated, });
    }

    // Amenities filter: comma separated names, mode: any|all
    const amenityNames = (amenities ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (amenityNames.length > 0) {
      if ((amenities_mode ?? 'any') === 'all') {
        for (const name of amenityNames) {
          and.push({
 amenity: {
 some: {
 name: {
 equals: name,
mode: 'insensitive' as const, 
}, 
}, 
}, 
});
        }
      } else {
        and.push({
          amenity: {
            some: {
 OR: amenityNames.map((name) => ({
 name: {
 equals: name,
mode: 'insensitive' as const, 
}, 
})), 
},
          },
        });
      }
    }

    // Minimum capacity via related areas
    if (typeof min_capacity === 'number') {
      and.push({ area: { some: { min_capacity: { gte: BigInt(min_capacity), }, }, }, });
    }

    // Bookmarked by a specific user
    if (bookmark_user_id) {
      and.push({ bookmark: { some: { user_id: BigInt(bookmark_user_id), }, }, });
    }

    // Availability by day_of_week
    const days = (available_days ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const normalizedDays = days
      .map((day) => {
        if (/^\d+$/.test(day)) {
          return Number(day);
        }
        if ((day as WeekdayName) in DAY_NAME_TO_INDEX) {
          return DAY_NAME_TO_INDEX[day as WeekdayName];
        }
        return null;
      })
      .filter((value): value is number => value !== null);

    const availabilityClause: Prisma.space_availabilityWhereInput = {};
    if (normalizedDays.length > 0) {
      availabilityClause.day_of_week = { in: normalizedDays, };
    }
    if (available_from) {
      availabilityClause.opening = { lte: timeStringToUtcDate(available_from), };
    }
    if (available_to) {
      availabilityClause.closing = { gte: timeStringToUtcDate(available_to), };
    }
    if (Object.keys(availabilityClause).length > 0) {
      and.push({ space_availability: { some: availabilityClause, }, });
    }

    // Rate-based price/time-unit filter via areas -> rates
    if (rate_time_unit || typeof min_rate_price === 'number' || typeof max_rate_price === 'number') {
      const priceCond: any = {};
      if (typeof min_rate_price === 'number') priceCond.gte = min_rate_price;
      if (typeof max_rate_price === 'number') priceCond.lte = max_rate_price;
      const rateCond: any = {};
      if (rate_time_unit) rateCond.time_unit = rate_time_unit;
      if (Object.keys(priceCond).length > 0) rateCond.price = priceCond;

      and.push({ area: { some: { rate_rate_area_idToarea: { some: rateCond, }, }, }, });
    }

    const where = and.length > 0 ? { AND: and, } : {};

    // Pagination and sorting
    const take = limit + 1; // read one extra to know if there's a next page
    const orderBy = (() => {
      const field = sort ?? 'id';
      const direction = order ?? 'asc';
      return { [field]: direction, } as const;
    })();

    const rows = await prisma.space.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy,
      include: {
        space_image: {
          orderBy: [
            { is_primary: 'desc' as const, },
            { display_order: 'asc' as const, },
            { created_at: 'asc' as const, }
          ],
          select: {
            path: true,
            is_primary: true,
            display_order: true,
          },
          take: 2,
        },
        area: {
          select: {
            id: true,
            price_rate: {
              select: {
                price: true,
                time_unit: true,
              },
            },
          },
        },
        verification: {
          orderBy: { created_at: 'desc' as const, },
          take: 1,
          select: { status: true, },
        },
        space_availability: {
          select: {
            day_of_week: true,
            opening: true,
            closing: true,
          },
          orderBy: { day_of_week: 'asc' as const, },
        },
      },
    });

    const signedImageUrlMap = await resolveSignedImageUrls(rows.flatMap((space) => space.space_image));

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? items[items.length - 1].id : null;

    const payload = items.map((space) => {
      const base = serializeSpace(space);
      const primaryImage = space.space_image[0];
      const priceSummary = summarizeRates(space.area);
      const resolvedImageUrl = (() => {
        const path = primaryImage?.path ?? null;
        if (!path) return null;
        if (isAbsoluteUrl(path)) return path;
        return signedImageUrlMap.get(path) ?? buildPublicObjectUrl(path);
      })();

      return {
        ...base,
        status: deriveSpaceStatus(space.verification[0]?.status ?? null),
        image_url: resolvedImageUrl,
        min_rate_price: priceSummary?.min ?? null,
        max_rate_price: priceSummary?.max ?? null,
        rate_time_unit: priceSummary?.unit ?? null,
        availability: serializeAvailabilitySlots(space.space_availability),
      };
    });

    const body = JSON.stringify({
      data: payload,
      nextCursor,
    }, replacer);

    return new NextResponse(body, {
      headers: { 'content-type': 'application/json', },
      status: 200, // per catalog
    });
  } catch (err) {
    // Typical errors in the catalog include 401/403/429; those are usually enforced by middleware.
    return NextResponse.json({ error: 'Failed to list spaces', }, { status: 500, });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Authentication required.', }, { status: 401, });
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      role: true,
      is_onboard: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User profile not found.', }, { status: 403, });
  }

  if (dbUser.role !== 'partner') {
    return NextResponse.json({ error: 'Only partner accounts can create spaces.', }, { status: 403, });
  }

  if (!dbUser.is_onboard) {
    return NextResponse.json({ error: 'Complete onboarding before submitting spaces.', }, { status: 409, });
  }

  const body = await req.json().catch(() => null);
  const parsed = spaceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  const sanitizedDescription = sanitizeRichText(parsed.data.description ?? '');
  const plainTextLength = richTextPlainTextLength(sanitizedDescription);

  if (plainTextLength < MIN_DESCRIPTION_CHARS || plainTextLength > MAX_DESCRIPTION_CHARS) {
    return NextResponse.json(
      { error: `Description must be between ${MIN_DESCRIPTION_CHARS} and ${MAX_DESCRIPTION_CHARS} characters.`, },
      { status: 422, }
    );
  }

  const uniqueAmenityIds = Array.from(new Set(parsed.data.amenities));
  const normalizedAvailability = normalizeAvailability(parsed.data.availability);
  const imagesPayload = parsed.data.images ?? [];
  const verificationDocsPayload = parsed.data.verification_documents ?? [];
  const now = new Date();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          user_id: dbUser.user_id,
          name: parsed.data.name.trim(),
          description: sanitizedDescription,
          unit_number: parsed.data.unit_number ?? '',
          address_subunit: parsed.data.address_subunit ?? '',
          street: parsed.data.street.trim(),
          barangay: parsed.data.barangay?.trim() ? parsed.data.barangay.trim() : null,
          city: parsed.data.city.trim(),
          region: parsed.data.region.trim(),
          postal_code: parsed.data.postal_code.trim(),
          country_code: parsed.data.country_code,
          lat: parsed.data.lat,
          long: parsed.data.long,
          created_at: now,
          updated_at: now,
        },
        select: {
          id: true,
          user_id: true,
          name: true,
          unit_number: true,
          street: true,
          address_subunit: true,
          city: true,
          region: true,
          country_code: true,
          postal_code: true,
          description: true,
          barangay: true,
          lat: true,
          long: true,
          created_at: true,
          updated_at: true,
        },
      });

      await updateSpaceLocationPoint(tx, {
        spaceId: space.id,
        lat: parsed.data.lat,
        long: parsed.data.long,
      });

      if (uniqueAmenityIds.length) {
        const amenityChoices = await tx.amenity_choice.findMany({
          where: { id: { in: uniqueAmenityIds, }, },
          select: { id: true, },
        });

        if (amenityChoices.length !== uniqueAmenityIds.length) {
          throw new HttpError(422, 'One or more amenities are invalid.');
        }

        await tx.amenity.createMany({
          data: amenityChoices.map((choice) => ({
            space_id: space.id,
            amenity_choice_id: choice.id,
          })),
        });
      }

      if (normalizedAvailability.length) {
        await tx.space_availability.createMany({
          data: normalizedAvailability.map((slot) => ({
            space_id: space.id,
            day_of_week: slot.dayIndex,
            opening: slot.opening,
            closing: slot.closing,
          })),
        });
      }

      if (imagesPayload.length) {
        await tx.space_image.createMany({
          data: imagesPayload.map((image) => ({
            space_id: space.id,
            path: image.path,
            category: image.category ?? null,
            display_order: BigInt(image.display_order),
            is_primary: image.is_primary ? 1 : 0,
            created_at: now,
          })),
        });
      }

      if (verificationDocsPayload.length) {
        const verificationRecord = await tx.verification.create({
          data: {
            subject_type: 'space',
            partner_id: null,
            space_id: space.id,
            status: 'in_review',
            submitted_at: now,
            created_at: now,
            updated_at: now,
          },
          select: { id: true, },
        });

        await tx.verification_document.createMany({
          data: verificationDocsPayload.map((doc) => ({
            verification_id: verificationRecord.id,
            document_type: REQUIREMENT_TO_DOCUMENT_TYPE[doc.requirement_id],
            path: doc.path,
            file_size_bytes: BigInt(doc.file_size_bytes),
            mime_type: doc.mime_type,
          })),
        });
      }

      return space;
    });

    const responsePayload = serializeSpace(created);
    const res = NextResponse.json({ data: responsePayload, }, { status: 201, });
    res.headers.set('Location', `/api/v1/spaces/${responsePayload.space_id}`);
    return res;
  } catch (error: any) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'User not found.', }, { status: 404, });
    }

    console.error('Failed to create space', error);
    return NextResponse.json({ error: 'Failed to create space', }, { status: 500, });
  }
}
