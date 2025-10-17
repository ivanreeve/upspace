import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

type Params = { params: { space_id?: string; area_id?: string; rate_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

const updateSchema = z.object({
  time_unit: z.string().min(1).max(100).optional(),
  price: z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
}).refine((data) => data.time_unit !== undefined || data.price !== undefined, {
  message: 'At least one of time_unit or price must be provided',
});

// PUT /api/v1/spaces/[space_id]/areas/[area_id]/rates/[rate_id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { space_id, area_id, rate_id } = params ?? {};

  if (!isNumericId(space_id) || !isNumericId(area_id) || !isNumericId(rate_id)) {
    return NextResponse.json(
      { error: 'space_id, area_id and rate_id are required and must be numeric' },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const spaceId = BigInt(space_id);
  const areaId = BigInt(area_id);
  const rateId = BigInt(rate_id);

  try {
    // ensure area exists and belongs to space
    const area = await prisma.area.findUnique({
      where: { area_id: areaId },
      select: { space_id: true },
    });

    if (!area || area.space_id !== spaceId) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    const data: { time_unit?: string; price?: string } = {};
    if (parsed.data.time_unit !== undefined) data.time_unit = parsed.data.time_unit;
    if (parsed.data.price !== undefined) data.price = parsed.data.price;

    const { count } = await prisma.rate.updateMany({
      where: { rate_id: rateId, area_id: areaId },
      data,
    });

    if (count === 0) {
      return NextResponse.json({ error: 'Rate not found' }, { status: 404 });
    }

    const updated = await prisma.rate.findUnique({
      where: { rate_id: rateId },
      select: { rate_id: true, area_id: true, time_unit: true, price: true },
    });

    if (!updated) {
      return NextResponse.json({ error: 'Rate not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        rate_id: updated.rate_id.toString(),
        area_id: updated.area_id.toString(),
        time_unit: updated.time_unit,
        price: updated.price.toString(),
      },
    }, { status: 200 });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Rate not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update rate' }, { status: 500 });
  }
}

