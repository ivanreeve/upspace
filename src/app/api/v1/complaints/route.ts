import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createComplaintPayloadSchema, customerComplaintsQuerySchema } from '@/lib/validations/complaint';
import { notifyComplaintFiled } from '@/lib/notifications/complaint';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createComplaintPayloadSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          'Invalid complaint payload.',
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

  if (!dbUser || dbUser.role !== 'customer') {
    return forbiddenResponse;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.booking_id, },
    select: {
      id: true,
      user_auth_id: true,
      partner_auth_id: true,
      space_id: true,
      space_name: true,
      area_id: true,
      area_name: true,
    },
  });

  if (!booking) {
    return NextResponse.json(
      { error: 'Booking not found.', },
      { status: 404, }
    );
  }

  if (booking.user_auth_id !== authData.user.id) {
    return forbiddenResponse;
  }

  const existingPending = await prisma.complaint.findFirst({
    where: {
      booking_id: booking.id,
      customer_user_id: dbUser.user_id,
      status: 'pending',
    },
    select: { id: true, },
  });

  if (existingPending) {
    return NextResponse.json(
      { error: 'You already have a pending complaint for this booking.', },
      { status: 409, }
    );
  }

  const complaint = await prisma.complaint.create({
    data: {
      booking_id: booking.id,
      customer_user_id: dbUser.user_id,
      customer_auth_id: authData.user.id,
      partner_auth_id: booking.partner_auth_id,
      category: parsed.data.category,
      description: parsed.data.description.trim(),
    },
    select: {
      id: true,
      status: true,
    },
  });

  await notifyComplaintFiled({
    bookingId: booking.id,
    spaceId: booking.space_id,
    areaId: booking.area_id,
    spaceName: booking.space_name,
    areaName: booking.area_name,
    customerAuthId: authData.user.id,
    partnerAuthId: booking.partner_auth_id,
  }).catch(() => {});

  return NextResponse.json(
    {
      complaintId: complaint.id,
      status: complaint.status,
      message: 'Complaint submitted successfully.',
    },
    { status: 201, }
  );
}

export async function GET(req: NextRequest) {
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

  if (!dbUser || dbUser.role !== 'customer') {
    return forbiddenResponse;
  }

  const { searchParams, } = new URL(req.url);
  const parsed = customerComplaintsQuerySchema.safeParse({
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
    limit,
    cursor,
  } = parsed.data;

  const complaints = await prisma.complaint.findMany({
    where: { customer_user_id: dbUser.user_id, },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor, }, } : {}),
    orderBy: { created_at: 'desc', },
    select: {
      id: true,
      category: true,
      description: true,
      status: true,
      escalation_note: true,
      resolution_note: true,
      created_at: true,
      booking: {
        select: {
          id: true,
          space_name: true,
          area_name: true,
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
    space_name: c.booking.space_name,
    area_name: c.booking.area_name,
    booking_id: c.booking.id,
  }));

  return NextResponse.json({
    data: payload,
    nextCursor,
  });
}
