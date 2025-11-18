import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { partnerSpaceInclude, serializePartnerSpace } from '@/lib/spaces/partner-serializer';
import { spaceDetailsSchema } from '@/lib/validations/spaces';

const isNumericId = (value: string | undefined): value is string => typeof value === 'string' && /^\d+$/.test(value);

type RouteParams = {
  params: {
    space_id?: string;
  };
};

export async function GET(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isNumericId(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be numeric.', }, { status: 400, });
    }

    const spaceId = BigInt(spaceIdParam);

    const space = await prisma.space.findFirst({
      where: {
        space_id: spaceId,
        user_id: userId,
      },
      include: partnerSpaceInclude,
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    return NextResponse.json({ data: serializePartnerSpace(space), });
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

    if (!isNumericId(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be numeric.', }, { status: 400, });
    }

    const body = await req.json().catch(() => null);
    const parsed = spaceDetailsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const spaceId = BigInt(spaceIdParam);
    const existing = await prisma.space.findFirst({
      where: {
        space_id: spaceId,
        user_id: userId,
      },
      select: { space_id: true, },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const values = parsed.data;

    await prisma.space.update({
      where: { space_id: spaceId, },
      data: {
        name: values.name.trim(),
        description: values.description,
        unit_number: values.unit_number ?? '',
        address_subunit: values.address_subunit ?? '',
        street: values.street.trim(),
        barangay: values.barangay?.trim() ?? '',
        city: values.city.trim(),
        region: values.region.trim(),
        postal_code: values.postal_code.trim(),
        country_code: values.country_code.trim().toUpperCase(),
        lat: values.lat,
        long: values.long,
        updated_at: new Date(),
      },
    });

    const space = await prisma.space.findUnique({
      where: { space_id: spaceId, },
      include: partnerSpaceInclude,
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    return NextResponse.json({ data: serializePartnerSpace(space), });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to update partner space', error);
    return NextResponse.json({ error: 'Unable to update space.', }, { status: 500, });
  }
}
