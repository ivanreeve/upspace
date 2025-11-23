import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ space_id?: string; area_id?: string }> };

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  capacity: z.string().regex(/^\d+$/).optional(),
}).refine((data) => data.name !== undefined || data.capacity !== undefined, { message: 'At least one of name or capacity must be provided', });

export async function PUT(req: NextRequest, { params, }: Params) {
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
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    const data: { name?: string; min_capacity?: bigint; max_capacity?: bigint } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.capacity !== undefined) {
      const capacityValue = BigInt(parsed.data.capacity);
      data.min_capacity = capacityValue;
      data.max_capacity = capacityValue;
    }

    // Ensure the area belongs to the given space_id and update
    const { count, } = await prisma.area.updateMany({
      where: {
        id: area_id,
        space_id,
      },
      data,
    });

    if (count === 0) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    const updated = await prisma.area.findUnique({
      where: { id: area_id, },
      select: {
        id: true,
        space_id: true,
        name: true,
        min_capacity: true,
        max_capacity: true,
      },
    });

    if (!updated) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    return NextResponse.json({
      data: {
        area_id: updated.id,
        space_id: updated.space_id,
        name: updated.name,
        min_capacity: updated.min_capacity.toString(),
        max_capacity: updated.max_capacity?.toString() ?? null,
      },
    }, { status: 200, });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      // Foreign key or relation error
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }
    if (err?.code === 'P2025') {
      // Record to update not found
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to update area', }, { status: 500, });
  }
}


export async function DELETE(_req: NextRequest, { params, }: Params) {
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
    const { count, } = await prisma.area.deleteMany({
      where: {
        id: area_id,
        space_id,
      },
    });

    if (count === 0) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    return new NextResponse(null, { status: 204, });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to delete area', }, { status: 500, });
  }
}
