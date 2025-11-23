import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ space_id?: string; area_id?: string; rate_id?: string }> };

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const updateSchema = z.object({
  time_unit: z.string().min(1).max(100).optional(),
  price: z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
}).refine((data) => data.time_unit !== undefined || data.price !== undefined, { message: 'At least one of time_unit or price must be provided', });

// PUT /api/v1/spaces/[space_id]/areas/[area_id]/rates/[rate_id]
export async function PUT(req: NextRequest, { params, }: Params) {
  const {
 space_id, area_id, rate_id, 
} = await params;

  if (!isUuid(space_id) || !isUuid(area_id) || !isUuid(rate_id)) {
    return NextResponse.json(
      { error: 'space_id, area_id and rate_id are required and must be valid UUIDs', },
      { status: 400, }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    // ensure area exists and belongs to space
    const area = await prisma.area.findUnique({
      where: { id: area_id, },
      select: { space_id: true, },
    });

    if (!area || area.space_id !== space_id) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    const data: { time_unit?: string; price?: string } = {};
    if (parsed.data.time_unit !== undefined) data.time_unit = parsed.data.time_unit;
    if (parsed.data.price !== undefined) data.price = parsed.data.price;

    const { count, } = await prisma.price_rate.updateMany({
      where: {
        id: rate_id,
        area_id,
      },
      data,
    });

    if (count === 0) {
      return NextResponse.json({ error: 'Rate not found', }, { status: 404, });
    }

    const updated = await prisma.price_rate.findUnique({
      where: { id: rate_id, },
      select: {
        id: true,
        area_id: true,
        time_unit: true,
        price: true,
      },
    });

    if (!updated) {
      return NextResponse.json({ error: 'Rate not found', }, { status: 404, });
    }

    return NextResponse.json({
      data: {
        rate_id: updated.id,
        area_id: updated.area_id,
        time_unit: updated.time_unit,
        price: updated.price.toString(),
      },
    }, { status: 200, });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Rate not found', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to update rate', }, { status: 500, });
  }
}

// DELETE /api/v1/spaces/[space_id]/areas/[area_id]/rates/[rate_id]
export async function DELETE(_req: NextRequest, { params, }: Params) {
  const {
 space_id, area_id, rate_id, 
} = await params;

  if (!isUuid(space_id) || !isUuid(area_id) || !isUuid(rate_id)) {
    return NextResponse.json(
      { error: 'space_id, area_id and rate_id are required and must be valid UUIDs', },
      { status: 400, }
    );
  }

  try {
    // ensure area exists and belongs to space
    const area = await prisma.area.findUnique({
      where: { id: area_id, },
      select: { space_id: true, },
    });

    if (!area || area.space_id !== space_id) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    const { count, } = await prisma.price_rate.deleteMany({
      where: {
        id: rate_id,
        area_id,
      },
    });

    if (count === 0) {
      return NextResponse.json({ error: 'Rate not found', }, { status: 404, });
    }

    return new NextResponse(null, { status: 204, });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to delete rate', }, { status: 500, });
  }
}
