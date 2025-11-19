import { NextRequest, NextResponse } from 'next/server';

import { WEEKDAY_ORDER, type WeekdayName } from '@/data/spaces';
import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { partnerSpaceInclude, serializePartnerSpace } from '@/lib/spaces/partner-serializer';
import { richTextPlainTextLength, sanitizeRichText } from '@/lib/rich-text';
import { spaceSchema, type SpaceFormValues } from '@/lib/validations/spaces';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type RouteParams = {
  params: {
    space_id?: string;
  };
};

const MIN_DESCRIPTION_CHARS = 20;
const MAX_DESCRIPTION_CHARS = 500;

type AvailabilitySlot = {
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

const toUtcDate = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
};

const normalizeAvailability = (availability: SpaceFormValues['availability']): AvailabilitySlot[] => {
  const slots: AvailabilitySlot[] = [];

  for (const day of WEEKDAY_ORDER) {
    const slot = availability[day];
    if (!slot || !slot.is_open) {
      continue;
    }

    slots.push({
      dayIndex: DAY_NAME_TO_INDEX[day],
      opening: toUtcDate(slot.opens_at),
      closing: toUtcDate(slot.closes_at),
    });
  }

  return slots;
};

export async function GET(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
    }

    const space = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      include: partnerSpaceInclude,
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const payload = await serializePartnerSpace(space);
    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to fetch partner space', error);
    return NextResponse.json({ error: 'Unable to load space.', }, { status: 500, });
  }
}

export async function PUT(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
    }

    const body = await req.json().catch(() => null);
    const parsed = spaceSchema.safeParse(body);

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

    const space = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      select: { id: true, },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const uniqueAmenityIds = Array.from(new Set(parsed.data.amenities ?? []));

    if (uniqueAmenityIds.length) {
      const validAmenities = await prisma.amenity_choice.findMany({
        where: { id: { in: uniqueAmenityIds, }, },
        select: { id: true, },
      });

      if (validAmenities.length !== uniqueAmenityIds.length) {
        return NextResponse.json({ error: 'One or more amenities are invalid.', }, { status: 422, });
      }
    }

    const normalizedAvailability = normalizeAvailability(parsed.data.availability);
    if (!normalizedAvailability.length) {
      return NextResponse.json({ error: 'Open the space on at least one day of the week.', }, { status: 422, });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.space.update({
        where: { id: spaceIdParam, },
        data: {
          name: parsed.data.name.trim(),
          description: sanitizedDescription,
          unit_number: parsed.data.unit_number?.trim() ?? '',
          address_subunit: parsed.data.address_subunit?.trim() ?? '',
          street: parsed.data.street.trim(),
          barangay: parsed.data.barangay?.trim() ? parsed.data.barangay.trim() : null,
          city: parsed.data.city.trim(),
          region: parsed.data.region.trim(),
          postal_code: parsed.data.postal_code.trim(),
          country_code: parsed.data.country_code.trim().toUpperCase(),
          lat: parsed.data.lat,
          long: parsed.data.long,
          updated_at: now,
        },
      });

      await tx.amenity.deleteMany({ where: { space_id: spaceIdParam, }, });

      if (uniqueAmenityIds.length) {
        await tx.amenity.createMany({
          data: uniqueAmenityIds.map((amenityId) => ({
            space_id: spaceIdParam,
            amenity_choice_id: amenityId,
          })),
        });
      }

      await tx.space_availability.deleteMany({ where: { space_id: spaceIdParam, }, });

      await tx.space_availability.createMany({
        data: normalizedAvailability.map((slot) => ({
          space_id: spaceIdParam,
          day_of_week: slot.dayIndex,
          opening: slot.opening,
          closing: slot.closing,
        })),
      });
    });

    const updatedSpace = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      include: partnerSpaceInclude,
    });

    if (!updatedSpace) {
      return NextResponse.json({ error: 'Unable to load space after update.', }, { status: 500, });
    }

    const payload = await serializePartnerSpace(updatedSpace);
    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to update partner space', error);
    return NextResponse.json({ error: 'Unable to update space.', }, { status: 500, });
  }
}
