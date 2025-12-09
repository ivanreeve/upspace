import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ space_id: string; amenity_id: string }> };

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function DELETE(_req: NextRequest, { params, }: Params) {
  const {
 space_id, amenity_id, 
} = await params;
  if (!isUuid(space_id) || !isUuid(amenity_id)) {
    return NextResponse.json({ error: 'space_id and amenity_id must be valid UUIDs', }, { status: 400, });
  }

  const { count, } = await prisma.amenity.deleteMany({
    where: {
      space_id,
      id: amenity_id,
    },
  });

  if (count === 0) {
    return NextResponse.json({ error: 'Amenity not found', }, { status: 404, });
  }

  return NextResponse.json({
    message: 'Amenity deleted successfully',
    data: {
      space_id,
      amenity_id,
      deleted: true,
    },
  }, { status: 200, });
}
