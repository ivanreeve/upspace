import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { serializeArea } from '@/lib/spaces/partner-serializer';
import type { PartnerSpaceRow } from '@/lib/spaces/partner-serializer';
import { areaSchema } from '@/lib/validations/spaces';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type RouteParams = {
  params: {
    space_id?: string;
    area_id?: string;
  };
};

export async function PUT(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;
    const areaIdParam = params?.area_id;

    if (!isUuid(spaceIdParam) || !isUuid(areaIdParam)) {
      return NextResponse.json({ error: 'space_id and area_id must be valid UUIDs.', }, { status: 400, });
    }

    const payload = await req.json().catch(() => null);
    const parsed = areaSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
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

    const existingArea = await prisma.area.findFirst({
      where: {
        id: areaIdParam,
        space_id: spaceIdParam,
      },
      select: { id: true, },
    });

    if (!existingArea) {
      return NextResponse.json({ error: 'Area not found.', }, { status: 404, });
    }

    if (parsed.data.price_rule_id) {
      const rule = await prisma.price_rule.findFirst({
        where: {
          id: parsed.data.price_rule_id,
          space_id: spaceIdParam,
        },
        select: { id: true, },
      });

      if (!rule) {
        return NextResponse.json({ error: 'Selected pricing rule is invalid.', }, { status: 400, });
      }
    }

    const bookingNotesEnabled = parsed.data.booking_notes_enabled;
    const bookingNotes = bookingNotesEnabled ? parsed.data.booking_notes?.trim() || null : null;
    const advanceBookingEnabled = parsed.data.advance_booking_enabled;
    const advanceBookingValue = advanceBookingEnabled ? parsed.data.advance_booking_value ?? null : null;
    const advanceBookingUnit = advanceBookingEnabled ? parsed.data.advance_booking_unit ?? null : null;

    const result = await prisma.$transaction(async (tx): Promise<PartnerSpaceRow['area'][number]> => {
      const updatePayload: Parameters<typeof tx.area.update>[0]['data'] = {
        name: parsed.data.name.trim(),
        min_capacity: BigInt(parsed.data.min_capacity),
        max_capacity: BigInt(parsed.data.max_capacity),
        automatic_booking_enabled: parsed.data.automatic_booking_enabled,
        request_approval_at_capacity: parsed.data.request_approval_at_capacity,
        advance_booking_enabled: advanceBookingEnabled,
        advance_booking_value: advanceBookingValue,
        advance_booking_unit: advanceBookingUnit,
        booking_notes_enabled: bookingNotesEnabled,
        booking_notes: bookingNotes,
        updated_at: new Date(),
      };

      const priceRuleId = parsed.data.price_rule_id;
      if (priceRuleId !== undefined) {
        updatePayload.price_rule_id = priceRuleId;
      }

      await tx.area.update({
        where: { id: areaIdParam, },
        data: updatePayload,
      });

      const areaWithRelations = await tx.area.findFirst({
        where: { id: areaIdParam, },
        include: { price_rule: true, },
      });

      if (!areaWithRelations) {
        throw new Error('Area could not be retrieved after update.');
      }

      return areaWithRelations;
    });

    return NextResponse.json({ data: serializeArea(result), });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to update area', error);
    return NextResponse.json({ error: 'Unable to update area.', }, { status: 500, });
  }
}

export async function DELETE(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;
    const areaIdParam = params?.area_id;

    if (!isUuid(spaceIdParam) || !isUuid(areaIdParam)) {
      return NextResponse.json({ error: 'space_id and area_id must be valid UUIDs.', }, { status: 400, });
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

    const existingArea = await prisma.area.findFirst({
      where: {
        id: areaIdParam,
        space_id: spaceIdParam,
      },
      select: { id: true, },
    });

    if (!existingArea) {
      return NextResponse.json({ error: 'Area not found.', }, { status: 404, });
    }

    await prisma.$transaction(async (tx) => {
      await tx.area.delete({ where: { id: areaIdParam, }, });
    });

    return new NextResponse(null, { status: 204, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to delete area', error);
    return NextResponse.json({ error: 'Unable to delete area.', }, { status: 500, });
  }
}
