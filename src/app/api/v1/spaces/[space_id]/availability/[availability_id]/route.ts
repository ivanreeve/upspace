import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ space_id?: string; availability_id?: string }> };

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
} = await params;
  if (!isUuid(space_id) || !isUuid(availability_id)) {
    return NextResponse.json({ error: 'space_id and availability_id must be valid UUIDs', }, { status: 400, });
  }

  const json = await req.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body', }, { status: 400, });
  }

  // Fetch existing to validate and compute derived values if partial
  const existing = await prisma.space_availability.findFirst({
    where: {
 id: availability_id,
 space_id,
    },
    select: {
 day_of_week: true,
 opening: true,
 closing: true,
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

  const dayIndex =
    nextDay !== undefined ? mondayFirstDays.indexOf(nextDay) : undefined;

  const openDate = nextOpenStr ? parseTimeToUTCDate(nextOpenStr) : existing.opening;
  const closeDate = nextCloseStr ? parseTimeToUTCDate(nextCloseStr) : existing.closing;

  if ((nextOpenStr && !openDate) || (nextCloseStr && !closeDate)) {
    return NextResponse.json({ error: 'Invalid time format. Use HH:mm or HH:mm:ss', }, { status: 422, });
  }

  if (!openDate || !closeDate) {
    return NextResponse.json({ error: 'Failed to parse availability times', }, { status: 500, });
  }

  if (closeDate <= openDate) {
    return NextResponse.json({ error: 'closing_time must be after opening_time', }, { status: 422, });
  }

  const updated = await prisma.space_availability.update({
    where: { id: availability_id, },
    data: {
      ...(dayIndex !== undefined ? { day_of_week: dayIndex, } : {}),
      ...(nextOpenStr !== undefined ? { opening: openDate, } : {}),
      ...(nextCloseStr !== undefined ? { closing: closeDate, } : {}),
    },
    select: {
      id: true,
      space_id: true,
      day_of_week: true,
      opening: true,
      closing: true,
    },
  });

  return NextResponse.json({
    data: {
      availability_id: updated.id,
      space_id: updated.space_id,
      day_of_week: String(updated.day_of_week),
      opening_time: updated.opening instanceof Date ? updated.opening.toISOString() : String(updated.opening),
      closing_time: updated.closing instanceof Date ? updated.closing.toISOString() : String(updated.closing),
    },
  }, { status: 200, });
}

// Delete a single availability slot by id
export async function DELETE(_req: NextRequest, { params, }: Params) {
  const {
 space_id, availability_id, 
} = await params;
  if (!isUuid(space_id) || !isUuid(availability_id)) {
    return NextResponse.json({ error: 'space_id and availability_id must be valid UUIDs', }, { status: 400, });
  }

  const { count, } = await prisma.space_availability.deleteMany({
    where: {
      id: availability_id,
      space_id,
    },
  });

  if (count === 0) {
    return NextResponse.json({ error: 'Availability not found', }, { status: 404, });
  }

  return NextResponse.json({
    message: 'Availability deleted successfully',
    data: {
      space_id,
      availability_id,
      deleted: true,
    },
  }, { status: 200, });
}
