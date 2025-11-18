import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { serializeArea } from '@/lib/spaces/partner-serializer';
import type { PartnerSpaceRow } from '@/lib/spaces/partner-serializer';
import { areaSchema } from '@/lib/validations/spaces';

const isNumericId = (value: string | undefined): value is string => typeof value === 'string' && /^\d+$/.test(value);

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

    if (!isNumericId(spaceIdParam) || !isNumericId(areaIdParam)) {
      return NextResponse.json({ error: 'space_id and area_id must be numeric.', }, { status: 400, });
    }

    const payload = await req.json().catch(() => null);
    const parsed = areaSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const spaceId = BigInt(spaceIdParam);
    const areaId = BigInt(areaIdParam);

    const space = await prisma.space.findFirst({
      where: {
        space_id: spaceId,
        user_id: userId,
      },
      select: { space_id: true, },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const existingArea = await prisma.area.findFirst({
      where: {
        area_id: areaId,
        space_id: spaceId,
      },
      select: { area_id: true, },
    });

    if (!existingArea) {
      return NextResponse.json({ error: 'Area not found.', }, { status: 404, });
    }

    const result = await prisma.$transaction(async (tx): Promise<PartnerSpaceRow['area'][number]> => {
      const updatedArea = await tx.area.update({
        where: { area_id: areaId, },
        data: {
          name: parsed.data.name.trim(),
          min_capacity: BigInt(parsed.data.min_capacity),
          max_capacity: BigInt(parsed.data.max_capacity),
          updated_at: new Date(),
        },
      });

      const existingRate = await tx.price_rate.findFirst({
        where: { area_id: areaId, },
        orderBy: { rate_id: 'asc', },
      });

      if (existingRate) {
        await tx.price_rate.update({
          where: { rate_id: existingRate.rate_id, },
          data: {
            time_unit: parsed.data.rate_time_unit,
            price: parsed.data.rate_amount.toString(),
            updated_at: new Date(),
          },
        });
      } else {
        await tx.price_rate.create({
          data: {
            area_id: areaId,
            time_unit: parsed.data.rate_time_unit,
            price: parsed.data.rate_amount.toString(),
          },
        });
      }

      const priceRates = await tx.price_rate.findMany({
        where: { area_id: areaId, },
        orderBy: { rate_id: 'asc', },
      });

      return {
        ...updatedArea,
        price_rate: priceRates,
      };
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
