import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string; area_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

export async function GET(_req: NextRequest, { params }: Params) {
  const { space_id, area_id } = params;

  if (!isNumericId(space_id) || !isNumericId(area_id)) {
    return NextResponse.json(
      { error: 'space_id and area_id are required and must be numeric' },
      { status: 400 },
    );
  }

  const spaceId = BigInt(space_id);
  const areaId = BigInt(area_id);

  try {
    const area = await prisma.area.findUnique({
      where: { area_id: areaId },
      select: { space_id: true },
    });

    if (!area || area.space_id !== spaceId) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    const rows = await prisma.rate.findMany({
      where: { area_id: areaId },
      orderBy: { rate_id: 'asc' },
      select: { rate_id: true, area_id: true, time_unit: true, price: true },
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        rate_id: r.rate_id.toString(),
        area_id: r.area_id.toString(),
        time_unit: r.time_unit,
        price: r.price.toString(),
      })),
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve rates' }, { status: 500 });
  }
}
