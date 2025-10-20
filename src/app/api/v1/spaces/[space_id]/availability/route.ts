import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

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

// Retrieve availability slots for a space
export async function GET(_req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be numeric', },
      { status: 400, }
    );
  }

  try {
    const rows = await prisma.space_availability.findMany({
      where: { space_id: BigInt(space_id), },
      select: {
        availability_id: true,
        space_id: true,
        day_of_week: true,
        opening_time: true,
        closing_time: true,
      },
    });

    const data = rows.map((r) => ({
      availability_id: r.availability_id.toString(),
      space_id: r.space_id.toString(),
      day_of_week: String(r.day_of_week),
      opening_time: r.opening_time instanceof Date ? r.opening_time.toISOString() : String(r.opening_time),
      closing_time: r.closing_time instanceof Date ? r.closing_time.toISOString() : String(r.closing_time),
    }));

    data.sort(
      (a, b) => mondayFirstDays.indexOf(a.day_of_week as MondayFirstDay) - mondayFirstDays.indexOf(b.day_of_week as MondayFirstDay)
    );

    return NextResponse.json({ data, }, { status: 200, });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve availability', }, { status: 500, });
  }
}

// Add availability slots to a space
export async function POST(req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be numeric', },
      { status: 400, }
    );
  }

  const json = await req.json().catch(() => null);
  if (!json || (typeof json !== 'object' && !Array.isArray(json))) {
    return NextResponse.json({ error: 'Invalid JSON body', }, { status: 400, });
  }

  type SlotInput = { day_of_week: MondayFirstDay; opening_time: string; closing_time: string };
  const inputs: SlotInput[] = Array.isArray(json) ? json : [json];

  // Basic validation
  const seenDays = new Set<string>();
  for (const [i, item] of inputs.entries()) {
    if (!item || typeof item !== 'object') {
      return NextResponse.json({ error: `Item ${i} is not an object`, }, { status: 400, });
    }
    const {
 day_of_week, opening_time, closing_time, 
} = item as Partial<SlotInput>;
    if (!day_of_week || !mondayFirstDays.includes(day_of_week as MondayFirstDay)) {
      return NextResponse.json({ error: `Invalid day_of_week at index ${i}`, }, { status: 422, });
    }
    if (seenDays.has(day_of_week)) {
      return NextResponse.json({ error: `Duplicate day_of_week '${day_of_week}' in request`, }, { status: 422, });
    }
    seenDays.add(day_of_week);
    const openDate = typeof opening_time === 'string' ? parseTimeToUTCDate(opening_time) : null;
    const closeDate = typeof closing_time === 'string' ? parseTimeToUTCDate(closing_time) : null;
    if (!openDate || !closeDate) {
      return NextResponse.json({ error: `Invalid time format at index ${i}. Use HH:mm or HH:mm:ss`, }, { status: 422, });
    }
    if (closeDate <= openDate) {
      return NextResponse.json({ error: `closing_time must be after opening_time at index ${i}`, }, { status: 422, });
    }
  }

  const spaceId = BigInt(space_id);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const createdRows: Array<{ availability_id: bigint; space_id: bigint; day_of_week: string; opening_time: Date; closing_time: Date; }> = [];
      for (const s of inputs) {
        await tx.space_availability.deleteMany({
 where: {
 space_id: spaceId,
day_of_week: s.day_of_week, 
}, 
});
        const row = await tx.space_availability.create({
          data: {
            space_id: spaceId,
            day_of_week: s.day_of_week,
            opening_time: parseTimeToUTCDate(s.opening_time)!,
            closing_time: parseTimeToUTCDate(s.closing_time)!,
          },
          select: {
            availability_id: true,
            space_id: true,
            day_of_week: true,
            opening_time: true,
            closing_time: true,
          },
        });
        createdRows.push(row);
      }
      return createdRows;
    });

    // Normalize response: day name + ISO times
    const data = created.map((r) => ({
      availability_id: r.availability_id.toString(),
      space_id: r.space_id.toString(),
      day_of_week: String(r.day_of_week),
      opening_time: r.opening_time instanceof Date ? r.opening_time.toISOString() : String(r.opening_time),
      closing_time: r.closing_time instanceof Date ? r.closing_time.toISOString() : String(r.closing_time),
    }));

    if (data.length === 1) {
      const res = NextResponse.json({ data: data[0], }, { status: 201, });
      res.headers.set('Location', `/api/v1/spaces/${space_id}/availability/${data[0].availability_id}`);
      return res;
    }

    return NextResponse.json({ data, }, { status: 201, });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to create availability', }, { status: 500, });
  }
}
