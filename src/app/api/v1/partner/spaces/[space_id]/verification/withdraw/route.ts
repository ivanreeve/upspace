import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { invalidateSpacesListCache } from '@/lib/cache/redis';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type RouteParams = {
  params: Promise<{
    space_id: string;
  }>;
};

export async function POST(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json(
        { error: 'space_id must be a valid UUID.', },
        { status: 400, }
      );
    }

    const space = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      select: { id: true, },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const pendingVerification = await prisma.verification.findFirst({
      where: {
        space_id: space.id,
        status: 'in_review',
      },
      orderBy: { submitted_at: 'desc', },
      select: { id: true, },
    });

    if (!pendingVerification) {
      return NextResponse.json(
        { error: 'No pending application to withdraw.', },
        { status: 409, }
      );
    }

    const now = new Date();
    const updated = await prisma.verification.update({
      where: { id: pendingVerification.id, },
      data: {
        status: 'draft',
        reviewed_at: null,
        rejected_at: null,
        rejected_reason: null,
        approved_at: null,
        valid_until: null,
        updated_at: now,
      },
    });

    await invalidateSpacesListCache();

    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.status,
        updated_at: updated.updated_at.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to withdraw verification application', error);
    return NextResponse.json(
      { error: 'Unable to withdraw the application.', },
      { status: 500, }
    );
  }
}
