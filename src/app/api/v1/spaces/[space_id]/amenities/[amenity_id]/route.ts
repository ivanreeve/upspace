import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string; amenity_id?: string } };

const isNumeric = (v: string | undefined): v is string => typeof v === 'string' && /^\d+$/.test(v);

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { space_id, amenity_id } = params;
  if (!isNumeric(space_id) || !isNumeric(amenity_id)) {
    return NextResponse.json({ error: 'space_id and amenity_id must be numeric' }, { status: 400 });
  }

  const spaceId = BigInt(space_id);
  const amenityId = BigInt(amenity_id);

  const { count } = await prisma.amenity.deleteMany({
    where: { space_id: spaceId, amenity_id: amenityId },
  });

  if (count === 0) {
    return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });
  }

  return NextResponse.json({
    message: 'Amenity deleted successfully',
    data: {
      space_id: spaceId.toString(),
      amenity_id: amenityId.toString(),
      deleted: true,
    },
  }, { status: 200 });
}