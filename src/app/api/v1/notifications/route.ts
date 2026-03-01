import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { NotificationRecord } from '@/lib/notifications/types';
import { prisma } from '@/lib/prisma';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const invalidPayloadResponse = NextResponse.json(
  { error: 'Invalid request payload.', },
  { status: 400, }
);

const querySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(['booking_confirmed', 'booking_received', 'message', 'system']).optional(),
});

const patchSchema = z.object({
  notificationId: z.string().uuid(),
  read: z.boolean().default(true),
});

const deleteSchema = z.object({ notificationId: z.string().uuid(), });

const mapNotification = (row: {
  id: string;
  user_auth_id: string;
  title: string;
  body: string;
  href: string;
  type: 'booking_confirmed' | 'booking_received' | 'message' | 'system';
  created_at: Date;
  read_at: Date | null;
  booking_id: string | null;
  space_id: string | null;
  area_id: string | null;
}): NotificationRecord => ({
  id: row.id,
  userAuthId: row.user_auth_id,
  title: row.title,
  body: row.body,
  href: row.href,
  type: row.type,
  createdAt: row.created_at.toISOString(),
  read: Boolean(row.read_at),
  readAt: row.read_at ? row.read_at.toISOString() : null,
  bookingId: row.booking_id,
  spaceId: row.space_id,
  areaId: row.area_id,
});

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return invalidPayloadResponse;
  }

  const {
 cursor, limit, type, 
} = parsed.data;

  const where: Record<string, unknown> = { user_auth_id: authData.user.id, };
  if (type) where.type = type;

  const notifications = await prisma.app_notification.findMany({
    where,
    orderBy: { created_at: 'desc', },
    take: limit + 1,
    ...(cursor ? {
 cursor: { id: cursor, },
skip: 1, 
} : {}),
  });

  const hasMore = notifications.length > limit;
  if (hasMore) notifications.pop();

  const nextCursor = hasMore ? notifications[notifications.length - 1]?.id : undefined;

  const mapped = notifications.map(mapNotification);
  return NextResponse.json({
    data: mapped,
    pagination: {
 hasMore,
nextCursor, 
},
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return invalidPayloadResponse;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const updated = await prisma.app_notification.updateMany({
    where: {
      id: parsed.data.notificationId,
      user_auth_id: authData.user.id,
    },
    data: { read_at: parsed.data.read ? new Date() : null, },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Notification not found.', }, { status: 404, });
  }

  const refreshed = await prisma.app_notification.findUnique({ where: { id: parsed.data.notificationId, }, });

  if (!refreshed) {
    return NextResponse.json({ error: 'Notification not found.', }, { status: 404, });
  }

  return NextResponse.json({ data: mapNotification(refreshed), });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return invalidPayloadResponse;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const deleted = await prisma.app_notification.deleteMany({
    where: {
      id: parsed.data.notificationId,
      user_auth_id: authData.user.id,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Notification not found.', }, { status: 404, });
  }

  return NextResponse.json({ data: { deleted: true, }, });
}
