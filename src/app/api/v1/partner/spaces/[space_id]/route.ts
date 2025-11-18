import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { partnerSpaceInclude, serializePartnerSpace } from '@/lib/spaces/partner-serializer';

const isNumericId = (value: string | undefined): value is string => typeof value === 'string' && /^\d+$/.test(value);

type RouteParams = {
  params: {
    space_id?: string;
  };
};

export async function GET(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isNumericId(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be numeric.', }, { status: 400, });
    }

    const spaceId = BigInt(spaceIdParam);

    const space = await prisma.space.findFirst({
      where: {
        space_id: spaceId,
        user_id: userId,
      },
      include: partnerSpaceInclude,
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const payload = await serializePartnerSpace(space);
    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to fetch partner space', error);
    return NextResponse.json({ error: 'Unable to load space.', }, { status: 500, });
  }
}
