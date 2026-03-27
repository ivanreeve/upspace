import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';

type Params = { params: Promise<{ space_id?: string; area_id?: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const querySchema = z.object({
  startAt: z.string().datetime(),
  hours: z.coerce.number().int().min(1).max(24),
});

export async function GET(req: NextRequest, { params, }: Params) {
  const {
 space_id, area_id, 
} = await params;

  if (!space_id || !UUID_PATTERN.test(space_id) || !area_id || !UUID_PATTERN.test(area_id)) {
    return NextResponse.json(
      { message: 'Valid space_id and area_id are required.', },
      { status: 400, }
    );
  }

  const parsed = querySchema.safeParse({
    startAt: req.nextUrl.searchParams.get('startAt'),
    hours: req.nextUrl.searchParams.get('hours'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Provide startAt (ISO datetime) and hours (1-24).', },
      { status: 400, }
    );
  }

  const area = await prisma.area.findFirst({
    where: {
 id: area_id,
space_id, 
},
    select: { max_capacity: true, },
  });

  if (!area) {
    return NextResponse.json(
      { message: 'Area not found.', },
      { status: 404, }
    );
  }

  const windowStart = new Date(parsed.data.startAt);
  const windowEnd = new Date(windowStart.getTime() + parsed.data.hours * 60 * 60 * 1000);

  const activeGuests = await countActiveBookingsOverlap(prisma, area_id, windowStart, windowEnd);

  const maxCapacity = area.max_capacity !== null ? Number(area.max_capacity) : null;
  const remaining = maxCapacity !== null ? Math.max(maxCapacity - activeGuests, 0) : null;

  return NextResponse.json({
    activeGuests,
    maxCapacity,
    remaining,
  }, { headers: { 'Cache-Control': 'no-store', }, });
}
