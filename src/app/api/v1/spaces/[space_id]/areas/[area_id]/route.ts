import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ space_id?: string; area_id?: string }> };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  capacity: z.string().regex(/^\d+$/).optional(),
}).refine((data) => data.name !== undefined || data.capacity !== undefined, { message: 'At least one of name or capacity must be provided', });

export async function PUT(req: NextRequest, { params, }: Params) {
  const {
 space_id, area_id, 
} = await params;

  if (!isNumericId(space_id) || !isNumericId(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be numeric', },
      { status: 400, }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  const spaceId = BigInt(space_id);
  const areaId = BigInt(area_id);

  try {
    const data: { name?: string; capacity?: bigint } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.capacity !== undefined) data.capacity = BigInt(parsed.data.capacity);

    // Ensure the area belongs to the given space_id and update
    const { count, } = await prisma.area.updateMany({
      where: {
 area_id: areaId,
space_id: spaceId, 
},
      data,
    });

    if (count === 0) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    const updated = await prisma.area.findUnique({
      where: { area_id: areaId, },
      select: {
 area_id: true,
space_id: true,
name: true,
capacity: true, 
},
    });

    if (!updated) {
      return NextResponse.json({ error: 'Area not found', }, { status: 404, });
    }

    return NextResponse.json({
      data: {
        area_id: updated.area_id.toString(),
        space_id: updated.space_id.toString(),
        name: updated.name,
        capacity: updated.capacity.toString(),
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

  if (!isNumericId(space_id) || !isNumericId(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be numeric', },
      { status: 400, }
    );
  }

  const spaceId = BigInt(space_id);
  const areaId = BigInt(area_id);

  try {
    const { count, } = await prisma.area.deleteMany({
 where: {
 area_id: areaId,
space_id: spaceId, 
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
