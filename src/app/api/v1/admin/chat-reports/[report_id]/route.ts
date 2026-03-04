import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { adminChatReportActionSchema } from '@/lib/validations/chat-report';

export async function PATCH(
  req: NextRequest,
  { params, }: { params: Promise<{ report_id: string }> }
) {
  const resolvedParams = await params;

  try {
    const session = await requireAdminSession(req);

    const parsedId = z.string().uuid().safeParse(resolvedParams.report_id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid report identifier.', }, { status: 400, });
    }

    const parsedBody = adminChatReportActionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error:
            parsedBody.error.issues[0]?.message ??
            'Invalid report action payload.',
        },
        { status: 400, }
      );
    }

    const report = await prisma.chat_report.findUnique({
      where: { id: parsedId.data, },
      select: {
        id: true,
        status: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found.', }, { status: 404, });
    }

    if (report.status !== 'pending') {
      return NextResponse.json(
        { error: 'This report has already been processed.', },
        { status: 400, }
      );
    }

    const now = new Date();
    const nextStatus = parsedBody.data.action === 'resolve' ? 'resolved' : 'dismissed';

    await prisma.chat_report.update({
      where: { id: report.id, },
      data: {
        status: nextStatus,
        processed_at: now,
        processed_by_user_id: session.userId,
        resolution_note: parsedBody.data.resolution_note?.trim() || null,
        updated_at: now,
      },
    });

    return NextResponse.json({ status: nextStatus, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to process chat report', error);
    return NextResponse.json(
      { error: 'Unable to process the chat report.', },
      { status: 500, }
    );
  }
}
