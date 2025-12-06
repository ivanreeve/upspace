import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

function formatDisplayName(first?: string | null, last?: string | null, fallback?: string) {
  if (first || last) {
    return [first, last].filter(Boolean).join(' ');
  }
  return fallback ?? 'UpSpace member';
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession();

    const { searchParams, } = new URL(req.url);
    const parsed = querySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), },
        { status: 400, }
      );
    }

    const {
 status, limit, cursor, 
} = parsed.data;

    const requests = await prisma.deactivation_request.findMany({
      where: { status, },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy: { created_at: 'asc', },
      include: {
        user_deactivation_request_user_idTouser: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
            status: true,
            pending_deletion_at: true,
            expires_at: true,
            cancelled_at: true,
            deleted_at: true,
          },
        },
        user_deactivation_request_processed_by_user_idTouser: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
          },
        },
      },
    });

    const hasNext = requests.length > limit;
    const items = hasNext ? requests.slice(0, limit) : requests;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((request) => ({
      id: request.id,
      status: request.status,
      reason_category: request.reason_category,
      custom_reason: request.custom_reason,
      rejection_reason: request.rejection_reason,
      created_at: request.created_at.toISOString(),
      processed_at: request.processed_at?.toISOString() ?? null,
      email: request.email,
      user: {
        handle: request.user_deactivation_request_user_idTouser.handle,
        name: formatDisplayName(
          request.user_deactivation_request_user_idTouser.first_name,
          request.user_deactivation_request_user_idTouser.last_name,
          request.user_deactivation_request_user_idTouser.handle
        ),
        status: request.user_deactivation_request_user_idTouser.status,
        pending_deletion_at: request.user_deactivation_request_user_idTouser.pending_deletion_at?.toISOString() ?? null,
        expires_at: request.user_deactivation_request_user_idTouser.expires_at?.toISOString() ?? null,
        cancelled_at: request.user_deactivation_request_user_idTouser.cancelled_at?.toISOString() ?? null,
        deleted_at: request.user_deactivation_request_user_idTouser.deleted_at?.toISOString() ?? null,
      },
      processed_by: request.user_deactivation_request_processed_by_user_idTouser
        ? {
            name: formatDisplayName(
              request.user_deactivation_request_processed_by_user_idTouser.first_name,
              request.user_deactivation_request_processed_by_user_idTouser.last_name,
              request.user_deactivation_request_processed_by_user_idTouser.handle
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
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }
    console.error('Failed to load deactivation requests', error);
    return NextResponse.json(
      { error: 'Unable to load deactivation requests.', },
      { status: 500, }
    );
  }
}
