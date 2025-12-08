import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { prisma } from '@/lib/prisma';
import { invalidateSpacesListCache } from '@/lib/cache/redis';
import { spaceVisibilityActionSchema } from '@/lib/validations/admin';

type RouteContext = {
  params: Promise<{ space_id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminSession(req);
    const { space_id, } = await context.params;

    const parsedId = z.string().uuid().safeParse(space_id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid space identifier.', },
        { status: 400, }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsedBody = spaceVisibilityActionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.flatten(), },
        { status: 400, }
      );
    }

    const space = await prisma.space.findUnique({
      where: { id: parsedId.data, },
      select: {
        id: true,
        is_published: true,
        unpublished_at: true,
        unpublished_reason: true,
        unpublished_by_admin: true,
      },
    });

    if (!space) {
      return NextResponse.json(
        { error: 'Space not found.', },
        { status: 404, }
      );
    }

    const now = new Date();
    const {
 action, reason, 
} = parsedBody.data;

    const updateData = action === 'hide'
      ? {
          is_published: false,
          unpublished_at: now,
          unpublished_reason: reason?.trim() || 'Hidden by admin',
          unpublished_by_admin: true,
          updated_at: now,
        }
      : {
          is_published: true,
          unpublished_at: null,
          unpublished_reason: null,
          unpublished_by_admin: false,
          updated_at: now,
        };

    const updated = await prisma.space.update({
      where: { id: space.id, },
      data: updateData,
      select: {
        id: true,
        is_published: true,
        unpublished_at: true,
        unpublished_reason: true,
        unpublished_by_admin: true,
      },
    });

    await invalidateSpacesListCache();
    return NextResponse.json({
      data: {
        id: updated.id,
        is_published: updated.is_published,
        unpublished_at: updated.unpublished_at?.toISOString() ?? null,
        unpublished_reason: updated.unpublished_reason,
        unpublished_by_admin: updated.unpublished_by_admin,
      },
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }
    console.error('Failed to update space visibility', error);
    return NextResponse.json(
      { error: 'Unable to update space visibility.', },
      { status: 500, }
    );
  }
}
