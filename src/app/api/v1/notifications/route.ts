import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapNotification } from '@/lib/notifications/serializer';
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
  unread: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

const patchSchema = z.object({
  notificationId: z.string().uuid(),
  read: z.boolean().default(true),
});

const deleteSchema = z.object({ notificationId: z.string().uuid(), });

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
 cursor, limit, type, unread,
} = parsed.data;

  const where: Record<string, unknown> = { user_auth_id: authData.user.id, };
  if (type) where.type = type;
  if (unread) where.read_at = null;

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
