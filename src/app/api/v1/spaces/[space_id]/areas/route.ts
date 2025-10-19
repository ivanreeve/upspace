import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

// List areas under a space
export async function GET(_req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be numeric', },
      { status: 400, }
    );
  }

  try {
    const rows = await prisma.area.findMany({
      where: { space_id: BigInt(space_id), },
      orderBy: { name: 'asc', },
      select: {
        area_id: true,
        space_id: true,
        name: true,
        capacity: true,
      },
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        area_id: r.area_id.toString(),
        space_id: r.space_id.toString(),
        name: r.name,
        capacity: r.capacity.toString(),
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
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be numeric', },
      { status: 400, }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    const created = await prisma.area.create({
      data: {
        space_id: BigInt(space_id),
        name: parsed.data.name,
        capacity: BigInt(parsed.data.capacity),
      },
    });

    const payload = {
      area_id: created.area_id.toString(),
      space_id: created.space_id.toString(),
      name: created.name,
      capacity: created.capacity.toString(),
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