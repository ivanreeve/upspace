import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type Params = { params: Promise<{ space_id?: string }> };

// List areas under a space
export async function GET(_req: NextRequest, { params, }: Params) {
  const { space_id, } = await params;
  if (!isUuid(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be a valid UUID', },
      { status: 400, }
    );
  }

  try {
    const rows = await prisma.area.findMany({
      where: { space_id, },
      orderBy: { name: 'asc', },
      select: {
        id: true,
        space_id: true,
        name: true,
        max_capacity: true,
      },
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        area_id: r.id,
        space_id: r.space_id,
        name: r.name,
        max_capacity: r.max_capacity?.toString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to list areas', }, { status: 500, });
  }
}

// Create a new area
const bodySchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.string().regex(/^\d+$/), // accept numeric string; convert to BigInt server-side
});

export async function POST(req: NextRequest, { params, }: Params) {
  const { space_id, } = await params;
  if (!isUuid(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be a valid UUID', },
      { status: 400, }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    const capacityValue = BigInt(parsed.data.capacity);
    const created = await prisma.area.create({
      data: {
        space_id,
        name: parsed.data.name,
        max_capacity: capacityValue,
      },
    });

    const payload = {
      area_id: created.id,
      space_id: created.space_id,
      name: created.name,
      max_capacity: created.max_capacity?.toString() ?? null,
    };

    const res = NextResponse.json({ data: payload, }, { status: 201, });
    res.headers.set('Location', `/api/v1/spaces/${space_id}/areas/${payload.area_id}`);
    return res;
  } catch (err: any) {
    if (err?.code === 'P2003') {
      // Foreign key constraint failed (space not found)
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to create area.', }, { status: 500, });
  }
}
