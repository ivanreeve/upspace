import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { partnerSpaceInclude, serializePartnerSpace } from '@/lib/spaces/partner-serializer';

export async function GET(req: NextRequest) {
  try {
    const { userId, } = await requirePartnerSession();
    await enforceRateLimit({
      scope: 'partner-spaces',
      request: req,
      identity: String(userId),
    });

    const spaces = await prisma.space.findMany({
      where: { user_id: userId, },
      orderBy: { created_at: 'desc', },
      include: partnerSpaceInclude,
    });

    const payload = await Promise.all(spaces.map((space) => serializePartnerSpace(space)));

    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: error.message, },
        {
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString(), },
        }
      );
    }

    console.error('Failed to list partner spaces', error);
    return NextResponse.json({ error: 'Unable to load spaces.', }, { status: 500, });
  }
}
