import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

const buildDisplayName = (first?: string | null, last?: string | null, handle?: string | null) => {
  const name = [first, last].filter(Boolean).join(' ').trim();
  if (name.length > 0) return name;
  if (handle?.trim()) return handle.trim();
  return 'UpSpace member';
};

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = querySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const {
 status, limit, cursor, 
} = parsed.data;

    const whereClause = status === 'approved'
      ? {
          status,
          // Once a space is republished we no longer want it to appear in the approved list.
          space: { is_published: false, },
        }
      : { status, };

    const requests = await prisma.unpublish_request.findMany({
      where: whereClause,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy: { created_at: 'asc', },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            is_published: true,
            user: {
              select: {
                handle: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        user_unpublish_request_user_idTouser: {
          select: {
            handle: true,
            first_name: true,
            last_name: true,
          },
        },
        user_unpublish_request_processed_by_user_idTouser: {
          select: {
            handle: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    const hasNext = requests.length > limit;
    const items = hasNext ? requests.slice(0, limit) : requests;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((req) => ({
      id: req.id,
      status: req.status,
      reason: req.reason,
      rejection_reason: req.rejection_reason,
      created_at: req.created_at.toISOString(),
      processed_at: req.processed_at?.toISOString() ?? null,
      space: {
        id: req.space.id,
        name: req.space.name,
        is_published: req.space.is_published,
        owner_name: buildDisplayName(req.space.user?.first_name, req.space.user?.last_name, req.space.user?.handle),
      },
      requester: {
        name: buildDisplayName(
          req.user_unpublish_request_user_idTouser?.first_name,
          req.user_unpublish_request_user_idTouser?.last_name,
          req.user_unpublish_request_user_idTouser?.handle
        ),
      },
      processed_by: req.user_unpublish_request_processed_by_user_idTouser
        ? {
            name: buildDisplayName(
              req.user_unpublish_request_processed_by_user_idTouser?.first_name,
              req.user_unpublish_request_processed_by_user_idTouser?.last_name,
              req.user_unpublish_request_processed_by_user_idTouser?.handle
            ),
          }
        : null,
    }));

    return NextResponse.json({
 data: payload,
nextCursor, 
});
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to list unpublish requests', error);
    return NextResponse.json({ error: 'Unable to load unpublish requests.', }, { status: 500, });
  }
}
