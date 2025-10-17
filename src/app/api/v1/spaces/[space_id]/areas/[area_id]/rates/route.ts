import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

type Params = { params: { space_id?: string; area_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

const createSchema = z.object({
  time_unit: z.string().min(1).max(100),
  // accept decimal as string to preserve precision
  price: z.string().regex(/^\d+(?:\.\d+)?$/),
});

// GET /api/v1/spaces/[space_id]/areas/[area_id]/rates
export async function GET(_req: NextRequest, { params }: Params) {
  const { space_id, area_id } = params ?? {};

  if (!isNumericId(space_id) || !isNumericId(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be numeric' },
      { status: 400 },
    );
  }

  const spaceId = BigInt(space_id);
  const areaId = BigInt(area_id);

  try {
    // ensure area exists and belongs to space
    const area = await prisma.area.findUnique({
      where: { area_id: areaId },
      select: { space_id: true },
    });

    if (!area || area.space_id !== spaceId) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    const rows = await prisma.rate.findMany({
      where: { area_id: areaId },
      orderBy: { rate_id: 'asc' },
      select: { rate_id: true, area_id: true, time_unit: true, price: true },
    });

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          rate_id: r.rate_id.toString(),
          area_id: r.area_id.toString(),
          time_unit: r.time_unit,
          price: r.price.toString(),
        })),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve rates' }, { status: 500 });
  }
}

// POST /api/v1/spaces/[space_id]/areas/[area_id]/rates
export async function POST(req: NextRequest, { params }: Params) {
  const { space_id, area_id } = params ?? {};

  if (!isNumericId(space_id) || !isNumericId(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be numeric' },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const spaceId = BigInt(space_id);
  const areaId = BigInt(area_id);

  try {
    // ensure area exists and belongs to the space
    const area = await prisma.area.findUnique({
      where: { area_id: areaId },
      select: { space_id: true },
    });

    if (!area || area.space_id !== spaceId) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    const created = await prisma.rate.create({
      data: {
        area_id: areaId,
        time_unit: parsed.data.time_unit,
        price: parsed.data.price, // Prisma Decimal accepts string
      },
      select: { rate_id: true, area_id: true, time_unit: true, price: true },
    });

    const payload = {
      rate_id: created.rate_id.toString(),
      area_id: created.area_id.toString(),
      time_unit: created.time_unit,
      price: created.price.toString(),
    };

    const res = NextResponse.json({ data: payload }, { status: 201 });
    // make path plural to match /rates
    res.headers.set(
      'Location',
      `/api/v1/spaces/${space_id}/areas/${area_id}/rates/${payload.rate_id}`,
    );
    return res;
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to create rate' }, { status: 500 });
  }
}
