import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string; availability_id?: string } };

const isNumeric = (v: string | undefined): v is string => typeof v === 'string' && /^\d+$/.test(v);

const mondayFirstDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;
type MondayFirstDay = typeof mondayFirstDays[number];

const parseTimeToUTCDate = (time: string): Date | null => {
  const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = m[3] ? Number(m[3]) : 0;
  return new Date(Date.UTC(1970, 0, 1, h, min, s));
};

// Update a single availability slot by id (partial update)
export async function PUT(req: NextRequest, { params, }: Params) {
  const {
 space_id, availability_id, 
} = params;
  if (!isNumeric(space_id) || !isNumeric(availability_id)) {
    return NextResponse.json({ error: 'space_id and availability_id must be numeric', }, { status: 400, });
  }

  const json = await req.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body', }, { status: 400, });
  }

  const spaceId = BigInt(space_id);
  const id = BigInt(availability_id);

  // Fetch existing to validate and compute derived values if partial
  const existing = await prisma.space_availability.findFirst({
    where: {
 availability_id: id,
space_id: spaceId, 
},
    select: {
 day_of_week: true,
opening_time: true,
closing_time: true, 
},
  });
  if (!existing) {
    return NextResponse.json({ error: 'Availability not found', }, { status: 404, });
  }

  const nextDay = (json as any).day_of_week as MondayFirstDay | undefined;
  const nextOpenStr = (json as any).opening_time as string | undefined;
  const nextCloseStr = (json as any).closing_time as string | undefined;

  if (
    nextDay === undefined &&
    nextOpenStr === undefined &&
    nextCloseStr === undefined
  ) {
    return NextResponse.json({ error: 'Provide at least one of day_of_week, opening_time, closing_time', }, { status: 400, });
  }

  if (nextDay !== undefined && !mondayFirstDays.includes(nextDay)) {
    return NextResponse.json({ error: 'Invalid day_of_week', }, { status: 422, });
  }

  const openDate = nextOpenStr ? parseTimeToUTCDate(nextOpenStr) : (existing.opening_time as Date);
  const closeDate = nextCloseStr ? parseTimeToUTCDate(nextCloseStr) : (existing.closing_time as Date);

  if ((nextOpenStr && !openDate) || (nextCloseStr && !closeDate)) {
    return NextResponse.json({ error: 'Invalid time format. Use HH:mm or HH:mm:ss', }, { status: 422, });
  }

  if (closeDate <= openDate) {
    return NextResponse.json({ error: 'closing_time must be after opening_time', }, { status: 422, });
  }

  const updated = await prisma.space_availability.update({
    where: { availability_id: id, },
    data: {
      ...(nextDay !== undefined ? { day_of_week: nextDay, } : {}),
      ...(nextOpenStr !== undefined ? { opening_time: openDate, } : {}),
      ...(nextCloseStr !== undefined ? { closing_time: closeDate, } : {}),
    },
    select: {
      availability_id: true,
      space_id: true,
      day_of_week: true,
      opening_time: true,
      closing_time: true,
    },
  });

  return NextResponse.json({
    data: {
      availability_id: updated.availability_id.toString(),
      space_id: updated.space_id.toString(),
      day_of_week: String(updated.day_of_week),
      opening_time: updated.opening_time instanceof Date ? updated.opening_time.toISOString() : String(updated.opening_time),
      closing_time: updated.closing_time instanceof Date ? updated.closing_time.toISOString() : String(updated.closing_time),
    },
  }, { status: 200, });
}

// Delete a single availability slot by id
export async function DELETE(_req: NextRequest, { params, }: Params) {
  const {
 space_id, availability_id, 
} = params;
  if (!isNumeric(space_id) || !isNumeric(availability_id)) {
    return NextResponse.json({ error: 'space_id and availability_id must be numeric', }, { status: 400, });
  }

  const spaceId = BigInt(space_id);
  const id = BigInt(availability_id);

  const { count, } = await prisma.space_availability.deleteMany({
 where: {
 availability_id: id,
space_id: spaceId, 
}, 
});

  if (count === 0) {
    return NextResponse.json({ error: 'Availability not found', }, { status: 404, });
  }

  return NextResponse.json({
    message: 'Availability deleted successfully',
    data: {
      space_id: spaceId.toString(),
      availability_id: id.toString(),
      deleted: true,
    },
  }, { status: 200, });
}