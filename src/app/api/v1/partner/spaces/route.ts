import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { partnerSpaceInclude, serializePartnerSpace } from '@/lib/spaces/partner-serializer';

export async function GET() {
  try {
    const { userId, } = await requirePartnerSession();

    const spaces = await prisma.space.findMany({
      where: { user_id: userId, },
      orderBy: { created_at: 'desc', },
      include: partnerSpaceInclude,
    });

    return NextResponse.json({ data: spaces.map(serializePartnerSpace), });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to list partner spaces', error);
    return NextResponse.json({ error: 'Unable to load spaces.', }, { status: 500, });
  }
}
