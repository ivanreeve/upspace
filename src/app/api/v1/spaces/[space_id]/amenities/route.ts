import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
});

type Params = { params: { space_id: string } };

export async function POST(req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!space_id) {
    return NextResponse.json({ error: 'space_id is required', }, { status: 400, });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    const created = await prisma.amenity.create({
      data: {
        space_id: BigInt(space_id),
        name: parsed.data.name,
        category: parsed.data.category,
      },
    });

    const payload = {
      amenity_id: created.amenity_id.toString(),
      space_id: created.space_id.toString(),
      name: created.name,
      category: created.category,
    };

    const res = NextResponse.json({ data: payload, }, { status: 201, });
    res.headers.set(
      'Location',
      `/api/v1/spaces/${space_id}/amenities/${payload.amenity_id}`
    );
    return res;
  } catch (err: any) {
    // Prisma error codes without importing Prisma explicitly
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Amenity with this name already exists for the space.', },
        { status: 409, }
      );
    }
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to create amenity.', }, { status: 500, });
  }
}

export async function GET(_req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!space_id) {
    return NextResponse.json({ error: 'space_id is required', }, { status: 400, });
  }

  const rows = await prisma.amenity.findMany({
    where: { space_id: BigInt(space_id), },
    orderBy: { name: 'asc', },
    select: {
 amenity_id: true,
space_id: true,
name: true,
category: true, 
},
  });

  return NextResponse.json({
    data: rows.map(r => ({
      amenity_id: r.amenity_id.toString(),
      space_id: r.space_id.toString(),
      name: r.name,
      category: r.category,
    })),
  });
}


const schema = z.object({ amenity_id: z.string().regex(/^\d+$/) });

export async function DELETE(req: NextRequest, { params }: Params) {
  const { space_id } = params;
  if (!/^\d+$/.test(space_id)) {
    return NextResponse.json({ error: "Invalid space_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const amenityId = BigInt(parsed.data.amenity_id);
  const spaceId = BigInt(space_id);

  const { count } = await prisma.amenity.deleteMany({
    where: { space_id: spaceId, amenity_id: amenityId },
  });

  if (count === 0) {
    return NextResponse.json({ error: "Amenity not found" }, { status: 404 });
  }

    return NextResponse.json({
    message: "Amenity deleted successfully",
    data: {
      space_id: spaceId.toString(),
      amenity_id: amenityId.toString(),
      deleted: true,
    },
  }, { status: 200 });
}