import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ space_id?: string; area_id?: string }> };

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const createSchema = z.object({
  time_unit: z.string().min(1).max(100),
  // accept decimal as string to preserve precision
  price: z.string().regex(/^\d+(?:\.\d+)?$/),
});

// GET /api/v1/spaces/[space_id]/areas/[area_id]/rates
export async function GET(_req: NextRequest, { params, }: Params) {
  const {
 space_id, area_id, 
} = await params;

  if (!isUuid(space_id) || !isUuid(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be valid UUIDs', },
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

    const rows = await prisma.price_rate.findMany({
      where: { area_id, },
      orderBy: { id: 'asc', },
      select: {
        id: true,
        area_id: true,
        time_unit: true,
        price: true,
      },
    });

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          rate_id: r.id,
          area_id: r.area_id,
          time_unit: r.time_unit,
          price: r.price.toString(),
        })),
      },
      { status: 200, }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve rates', }, { status: 500, });
  }
}

// POST /api/v1/spaces/[space_id]/areas/[area_id]/rates
export async function POST(req: NextRequest, { params, }: Params) {
  const {
 space_id, area_id, 
} = await params;

  if (!isUuid(space_id) || !isUuid(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be valid UUIDs', },
      { status: 400, }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    // ensure area exists and belongs to the space
    const area = await prisma.area.findUnique({
      where: { id: area_id, },
      select: { space_id: true, },
    });

    if (!area || area.space_id !== space_id) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    const created = await prisma.price_rate.create({
      data: {
        area_id,
        time_unit: parsed.data.time_unit,
        price: parsed.data.price, // Prisma Decimal accepts string
      },
      select: {
        id: true,
        area_id: true,
        time_unit: true,
        price: true,
      },
    });

    const payload = {
      rate_id: created.id,
      area_id: created.area_id,
      time_unit: created.time_unit,
      price: created.price.toString(),
    };

    const res = NextResponse.json({ data: payload, }, { status: 201, });
    res.headers.set(
      'Location',
      `/api/v1/spaces/${space_id}/areas/${area_id}/rates/${payload.rate_id}`
    );
    return res;
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to create rate', }, { status: 500, });
  }
}
