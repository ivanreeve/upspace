import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { WEEKDAY_ORDER, type WeekdayName } from '@/data/spaces';
import { prisma } from '@/lib/prisma';
import { invalidateSpacesListCache } from '@/lib/cache/redis';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { richTextPlainTextLength, sanitizeRichText } from '@/lib/rich-text';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
  file_size_bytes: z.number().int().positive().max(50 * 1024 * 1024),
});

const weeklyAvailabilitySchema = z.record(
  z.enum(WEEKDAY_ORDER),
  z.object({
    is_open: z.boolean(),
    opens_at: z.string(),
    closes_at: z.string(),
  })
);

const resubmitSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().min(1),
  unit_number: z.string().max(200).optional(),
  address_subunit: z.string().max(200).optional(),
  street: z.string().trim().min(1).max(200),
  barangay: z.string().max(200).optional(),
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
  images: z.array(spaceImageSchema).max(50),
  verification_documents: z.array(verificationDocumentSchema).max(20),
});

type ResubmitInput = z.infer<typeof resubmitSchema>;
type VerificationRequirementId = (typeof VERIFICATION_REQUIREMENT_IDS)[number];

const REQUIREMENT_TO_DOCUMENT_TYPE: Record<VerificationRequirementId, 'dti_registration' | 'bir_cor' | 'authorized_rep_id'> = {
  dti_registration: 'dti_registration',
  tax_registration: 'bir_cor',
  representative_id: 'authorized_rep_id',
};

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

const normalizeAvailability = (availability: ResubmitInput['availability']): AvailabilitySlot[] => {
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

export async function POST(req: NextRequest, { params, }: { params: Promise<{ space_id: string }> }) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json(
        { error: 'space_id must be a valid UUID.', },
        { status: 400, }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = resubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const sanitizedDescription = sanitizeRichText(parsed.data.description ?? '');
    const plainTextLength = richTextPlainTextLength(sanitizedDescription);
    if (plainTextLength < 20) {
      return NextResponse.json(
        { error: 'Description must be at least 20 characters.', },
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

    const result = await prisma.$transaction(async (tx) => {
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

      await tx.space_image.deleteMany({ where: { space_id: spaceIdParam, }, });
      if (parsed.data.images.length) {
        await tx.space_image.createMany({
          data: parsed.data.images.map((image) => ({
            space_id: spaceIdParam,
            path: image.path,
            category: image.category ?? null,
            display_order: BigInt(image.display_order),
            is_primary: image.is_primary ? 1 : 0,
            created_at: now,
          })),
        });
      }

      const verificationRecord = await tx.verification.create({
        data: {
          subject_type: 'space',
          partner_id: null,
          space_id: spaceIdParam,
          status: 'in_review',
          submitted_at: now,
          created_at: now,
          updated_at: now,
        },
        select: { id: true, },
      });

      if (parsed.data.verification_documents.length) {
        await tx.verification_document.createMany({
          data: parsed.data.verification_documents.map((doc) => ({
            verification_id: verificationRecord.id,
            document_type: REQUIREMENT_TO_DOCUMENT_TYPE[doc.requirement_id],
            path: doc.path,
            file_size_bytes: BigInt(doc.file_size_bytes),
            mime_type: doc.mime_type,
          })),
        });
      }

      return verificationRecord.id;
    });

    await invalidateSpacesListCache();

    return NextResponse.json({
      data: {
        space_id: spaceIdParam,
        verification_id: result,
        status: 'in_review',
      },
    });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to resubmit space verification', error);
    return NextResponse.json({ error: 'Failed to submit for review.', }, { status: 500, });
  }
}
