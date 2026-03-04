import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { formatUserDisplayName } from '@/lib/user/display-name';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { adminChatReportsQuerySchema } from '@/lib/validations/chat-report';

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = adminChatReportsQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            'Invalid report query parameters.',
        },
        { status: 400, }
      );
    }

    const {
      status,
      limit,
      cursor,
    } = parsed.data;

    const reports = await prisma.chat_report.findMany({
      where: { status, },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy: { created_at: 'asc', },
      include: {
        chat_room: {
          select: {
            id: true,
            space: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user_chat_report_reporter_idTouser: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
            role: true,
          },
        },
        user_chat_report_reported_user_idTouser: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
            role: true,
          },
        },
        user_chat_report_processed_by_user_idTouser: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
          },
        },
      },
    });

    const hasNext = reports.length > limit;
    const items = hasNext ? reports.slice(0, limit) : reports;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((report) => ({
      id: report.id,
      room_id: report.chat_room.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      created_at: report.created_at.toISOString(),
      processed_at: report.processed_at?.toISOString() ?? null,
      resolution_note: report.resolution_note,
      space: {
        id: report.chat_room.space.id,
        name: report.chat_room.space.name,
      },
      reporter: {
        role: report.user_chat_report_reporter_idTouser.role,
        handle: report.user_chat_report_reporter_idTouser.handle,
        name: formatUserDisplayName(
          report.user_chat_report_reporter_idTouser.first_name,
          report.user_chat_report_reporter_idTouser.last_name,
          report.user_chat_report_reporter_idTouser.handle
        ),
      },
      reported_user: {
        role: report.user_chat_report_reported_user_idTouser.role,
        handle: report.user_chat_report_reported_user_idTouser.handle,
        name: formatUserDisplayName(
          report.user_chat_report_reported_user_idTouser.first_name,
          report.user_chat_report_reported_user_idTouser.last_name,
          report.user_chat_report_reported_user_idTouser.handle
        ),
      },
      processed_by: report.user_chat_report_processed_by_user_idTouser
        ? {
            name: formatUserDisplayName(
              report.user_chat_report_processed_by_user_idTouser.first_name,
              report.user_chat_report_processed_by_user_idTouser.last_name,
              report.user_chat_report_processed_by_user_idTouser.handle
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

    console.error('Failed to load chat reports', error);
    return NextResponse.json(
      { error: 'Unable to load chat reports.', },
      { status: 500, }
    );
  }
}
