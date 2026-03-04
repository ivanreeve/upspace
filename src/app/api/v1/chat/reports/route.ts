import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createChatReportPayloadSchema } from '@/lib/validations/chat-report';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Conversation not found.', },
  { status: 404, }
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createChatReportPayloadSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          'Invalid report payload.',
      },
      { status: 400, }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      role: true,
    },
  });

  if (!dbUser) {
    return forbiddenResponse;
  }

  if (dbUser.role !== 'customer' && dbUser.role !== 'partner') {
    return forbiddenResponse;
  }

  const room = await prisma.chat_room.findUnique({
    where: { id: parsed.data.room_id, },
    select: {
      id: true,
      customer_id: true,
      space: { select: { user_id: true, }, },
    },
  });

  if (!room) {
    return notFoundResponse;
  }

  const isCustomerReporter = dbUser.role === 'customer';

  if (isCustomerReporter && room.customer_id !== dbUser.user_id) {
    return forbiddenResponse;
  }

  if (!isCustomerReporter && room.space.user_id !== dbUser.user_id) {
    return forbiddenResponse;
  }

  const reportedUserId = isCustomerReporter ? room.space.user_id : room.customer_id;

  if (reportedUserId === dbUser.user_id) {
    return NextResponse.json(
      { error: 'Unable to report this conversation.', },
      { status: 400, }
    );
  }

  const existingPendingReport = await prisma.chat_report.findFirst({
    where: {
      room_id: room.id,
      reporter_id: dbUser.user_id,
      status: 'pending',
    },
    select: { id: true, },
  });

  if (existingPendingReport) {
    return NextResponse.json(
      { error: 'You already have a pending report for this conversation.', },
      { status: 409, }
    );
  }

  const report = await prisma.chat_report.create({
    data: {
      room_id: room.id,
      reporter_id: dbUser.user_id,
      reported_user_id: reportedUserId,
      reason: parsed.data.reason,
      details: parsed.data.details?.trim() || null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return NextResponse.json(
    {
      reportId: report.id,
      status: report.status,
      message: 'Report submitted. Our moderators will review it shortly.',
    },
    { status: 201, }
  );
}
