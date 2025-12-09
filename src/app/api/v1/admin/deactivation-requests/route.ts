import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { formatUserDisplayName } from '@/lib/user/display-name';

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  type: z.enum(['deactivate', 'delete']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = querySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), },
        { status: 400, }
      );
    }

    const {
      status,
      type,
      limit,
      cursor,
    } = parsed.data;
    const typeClause = type
      ? { type, }
      : {};
    const cursorValue = cursor ? { id: cursor, } : undefined;
    const requests = await prisma.deactivation_request.findMany({
      where: {
        status,
        ...typeClause,
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursorValue,
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
            role: true,
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

    const payload = items.map((request) => {
      const requester = request.user_deactivation_request_user_idTouser;
      const processor = request.user_deactivation_request_processed_by_user_idTouser;

      return {
        id: request.id,
        status: request.status,
        type: request.type,
        reason_category: request.reason_category,
        custom_reason: request.custom_reason,
        rejection_reason: request.rejection_reason,
        created_at: request.created_at.toISOString(),
        processed_at: request.processed_at?.toISOString() ?? null,
        email: request.email,
        user: {
          handle: requester.handle,
          role: requester.role,
          name: formatUserDisplayName(
            requester.first_name,
            requester.last_name,
            requester.handle
          ),
          status: requester.status,
          pending_deletion_at: requester.pending_deletion_at?.toISOString() ?? null,
          expires_at: requester.expires_at?.toISOString() ?? null,
          cancelled_at: requester.cancelled_at?.toISOString() ?? null,
          deleted_at: requester.deleted_at?.toISOString() ?? null,
        },
        processed_by: processor
          ? {
            name: formatUserDisplayName(
              processor.first_name,
              processor.last_name,
              processor.handle
            ),
            }
          : null,
      };
    });

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
