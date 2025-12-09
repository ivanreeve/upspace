import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';

const bodySchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value?.trim() || null),
});

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type RouteParams = {
  params: Promise<{
    space_id: string;
  }>;
};

export async function POST(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
    }

    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten(), }, { status: 400, });
    }

    const space = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      select: {
        id: true,
        is_published: true,
      },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    if (!space.is_published) {
      return NextResponse.json({ error: 'Space is already unpublished.', }, { status: 409, });
    }

    const pending = await prisma.unpublish_request.findFirst({
      where: {
        space_id: space.id,
        status: 'pending',
      },
      select: { id: true, },
    });

    if (pending) {
      return NextResponse.json({ error: 'A request is already pending review.', }, { status: 409, });
    }

    const now = new Date();
    const request = await prisma.unpublish_request.create({
      data: {
        space_id: space.id,
        user_id: userId,
        reason: parsedBody.data.reason,
        created_at: now,
        updated_at: now,
      },
      select: {
        id: true,
        status: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      data: {
        id: request.id,
        status: request.status,
        created_at: request.created_at.toISOString(),
      },
    }, { status: 201, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to create unpublish request', error);
    return NextResponse.json({ error: 'Unable to submit unpublish request.', }, { status: 500, });
  }
}
