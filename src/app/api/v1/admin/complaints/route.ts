import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { formatUserDisplayName } from '@/lib/user/display-name';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { adminComplaintsQuerySchema } from '@/lib/validations/complaint';

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = adminComplaintsQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            'Invalid query parameters.',
        },
        { status: 400, }
      );
    }

    const {
      status,
      limit,
      cursor,
    } = parsed.data;

    const complaints = await prisma.complaint.findMany({
      where: { status, },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy: { created_at: 'asc', },
      select: {
        id: true,
        category: true,
        description: true,
        status: true,
        escalation_note: true,
        resolution_note: true,
        created_at: true,
        processed_at: true,
        booking: {
          select: {
            id: true,
            space_name: true,
            area_name: true,
          },
        },
        customer: {
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

    const hasNext = complaints.length > limit;
    const items = hasNext ? complaints.slice(0, limit) : complaints;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((c) => ({
      id: c.id,
      category: c.category,
      description: c.description,
      status: c.status,
      escalation_note: c.escalation_note,
      resolution_note: c.resolution_note,
      created_at: c.created_at.toISOString(),
      processed_at: c.processed_at?.toISOString() ?? null,
      space_name: c.booking.space_name,
      area_name: c.booking.area_name,
      booking_id: c.booking.id,
      customer: {
        handle: c.customer.handle,
        name: formatUserDisplayName(
          c.customer.first_name,
          c.customer.last_name,
          c.customer.handle
        ),
      },
      processed_by: c.processed_by
        ? {
            name: formatUserDisplayName(
              c.processed_by.first_name,
              c.processed_by.last_name,
              c.processed_by.handle
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

    console.error('Failed to load complaints', error);
    return NextResponse.json(
      { error: 'Unable to load complaints.', },
      { status: 500, }
    );
  }
}
