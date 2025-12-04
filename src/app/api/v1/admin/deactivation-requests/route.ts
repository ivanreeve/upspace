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
        user: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
          },
        },
        processed_by: {
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
        handle: request.user.handle,
        name: formatDisplayName(request.user.first_name, request.user.last_name, request.user.handle),
      },
      processed_by: request.processed_by
        ? {
            name: formatDisplayName(
              request.processed_by.first_name,
              request.processed_by.last_name,
              request.processed_by.handle
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
