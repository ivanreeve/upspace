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
  };
};

export async function POST(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
    }

    const body = await req.json().catch(() => null);
    const parsed = areaSchema.safeParse(body);

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

    const result = await prisma.$transaction(async (tx): Promise<PartnerSpaceRow['area'][number]> => {
      const createdArea = await tx.area.create({
        data: {
          space_id: spaceIdParam,
          name: parsed.data.name.trim(),
          min_capacity: BigInt(parsed.data.min_capacity),
          max_capacity: BigInt(parsed.data.max_capacity),
        },
      });

      const createdRate = await tx.price_rate.create({
        data: {
          area_id: createdArea.id,
          time_unit: parsed.data.rate_time_unit,
          price: parsed.data.rate_amount.toString(),
        },
      });

      return {
        ...createdArea,
        price_rate: [createdRate],
      };
    });

    return NextResponse.json({ data: serializeArea(result), }, { status: 201, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to create area', error);
    return NextResponse.json({ error: 'Unable to create area.', }, { status: 500, });
  }
}
