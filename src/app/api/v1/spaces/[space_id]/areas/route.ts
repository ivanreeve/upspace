import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);


// List areas for a given space
export async function GET(_req: NextRequest, { params }: Params) {
  const { space_id } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be numeric' },
      { status: 400 },
    );
  }

  try {
    const rows = await prisma.area.findMany({
      where: { space_id: BigInt(space_id) },
      orderBy: { name: 'asc' },
      select: {
        area_id: true,
        space_id: true,
        name: true,
        capacity: true,
      },
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        area_id: r.area_id.toString(),
        space_id: r.space_id.toString(),
        name: r.name,
        capacity: r.capacity.toString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to list areas' }, { status: 500 });
  }
}