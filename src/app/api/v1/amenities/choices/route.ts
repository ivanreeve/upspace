import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const amenities = await prisma.amenity_choice.findMany({
      orderBy: [
        { category: 'asc', },
        { name: 'asc', }
      ],
      select: {
        id: true,
        name: true,
        category: true,
        identifier: true,
      },
    });

    return NextResponse.json({
      data: amenities.map((amenity) => ({
        id: amenity.id,
        name: amenity.name,
        category: amenity.category,
        identifier: amenity.identifier,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch amenity choices', error);
    return NextResponse.json(
      { error: 'Failed to fetch amenity choices.', },
      { status: 500, }
    );
  }
}
