import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const toDayName = (value: unknown): string => {
  if (value instanceof Date) return dayNames[value.getUTCDay()];
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : dayNames[d.getUTCDay()];
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
      orderBy: [
        { day_of_week: 'asc', },
        { opening_time: 'asc', }
      ],
      select: {
        availability_id: true,
        space_id: true,
        day_of_week: true,
        opening_time: true,
        closing_time: true,
      },
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        availability_id: r.availability_id.toString(),
        space_id: r.space_id.toString(),
        day_of_week: toDayName(r.day_of_week),
        opening_time: r.opening_time instanceof Date ? r.opening_time.toISOString() : String(r.opening_time),
        closing_time: r.closing_time instanceof Date ? r.closing_time.toISOString() : String(r.closing_time),
      })),
    }, { status: 200, });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve availability', }, { status: 500, });
  }
}
