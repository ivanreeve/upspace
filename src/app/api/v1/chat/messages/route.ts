import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { chatMessagePayloadSchema, chatMessageRoomQuerySchema } from '@/lib/validations/chat';
import { formatDisplayName, mapChatMessage } from '@/lib/chat/utils';

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

const MESSAGE_NOTIFICATION_PREVIEW_MAX_LENGTH = 180;

const toMessagePreview = (content: string) =>
  content.length > MESSAGE_NOTIFICATION_PREVIEW_MAX_LENGTH
    ? `${content.slice(0, MESSAGE_NOTIFICATION_PREVIEW_MAX_LENGTH - 3)}...`
    : content;

async function createMessageNotification({
  recipientAuthId,
  href,
  senderLabel,
  content,
}: {
  recipientAuthId: string | null | undefined;
  href: string;
  senderLabel: string;
  content: string;
}) {
  if (!recipientAuthId) {
    return;
  }

  await prisma.app_notification.create({
    data: {
      user_auth_id: recipientAuthId,
      title: `New message from ${senderLabel}`,
      body: toMessagePreview(content),
      href,
      type: 'message',
    },
  });
}


export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = chatMessageRoomQuerySchema.safeParse({ room_id: url.searchParams.get('room_id') ?? undefined, });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request payload.', },
      { status: 400, }
    );
  }

  const cursorParam = url.searchParams.get('cursor') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 50, 1), 100) : 50;

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
      handle: true,
      first_name: true,
      last_name: true,
      avatar: true,
    },
  });

  if (!dbUser) {
    return forbiddenResponse;
  }

  const room = await prisma.chat_room.findUnique({
    where: { id: parsed.data.room_id, },
    include: {
      user: {
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          handle: true,
          avatar: true,
        },
      },
      space: {
        select: {
          user_id: true,
          user: {
            select: {
              first_name: true,
              last_name: true,
              handle: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!room) {
    return notFoundResponse;
  }

  if (dbUser.role === 'customer') {
    if (room.user.user_id !== dbUser.user_id) {
      return forbiddenResponse;
    }
  } else if (dbUser.role === 'partner') {
    if (!room.space || room.space.user_id !== dbUser.user_id) {
      return forbiddenResponse;
    }
  } else {
    return forbiddenResponse;
  }

  const chatMessages = await prisma.chat_message.findMany({
    where: { room_id: parsed.data.room_id, },
    orderBy: { created_at: 'desc', },
    take: limit + 1,
    ...(cursorParam ? {
 cursor: { id: cursorParam, },
skip: 1, 
} : {}),
  });

  const hasMore = chatMessages.length > limit;
  if (hasMore) chatMessages.pop();

  // Reverse to chronological order for display
  chatMessages.reverse();

  const nextCursor = hasMore ? chatMessages[0]?.id : undefined;
  const customerName = formatDisplayName(room.user);
  const partnerName = formatDisplayName(room.space?.user ?? null);

  const messages = chatMessages.map((chat_message) =>
    mapChatMessage(chat_message, customerName, partnerName)
  );

  const messageHref =
    dbUser.role === 'partner'
      ? `/partner/messages/${room.id}`
      : `/customer/messages/${room.id}`;

  try {
    await prisma.app_notification.updateMany({
      where: {
        user_auth_id: authData.user.id,
        type: 'message',
        href: messageHref,
        read_at: null,
      },
      data: { read_at: new Date(), },
    });
  } catch (readSyncError) {
    console.error('Failed to mark message notifications as read', {
      roomId: room.id,
      error: readSyncError,
    });
  }

  return NextResponse.json({
    messages,
    pagination: {
 hasMore,
nextCursor, 
},
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = chatMessagePayloadSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request payload.', },
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

  try {
    await enforceRateLimit({
 scope: 'chat-messages',
request: req,
identity: authData.user.id, 
});
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: error.message, },
        {
 status: 429,
headers: { 'Retry-After': error.retryAfter.toString(), }, 
}
      );
    }
    console.error('Rate limit check failed for chat messages', error);
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      role: true,
      handle: true,
      first_name: true,
      last_name: true,
      avatar: true,
    },
  });

  if (!dbUser) {
    return forbiddenResponse;
  }

  if (dbUser.role === 'customer') {
    const spaceId = parsed.data.space_id;
    const roomId = parsed.data.room_id;

    const customerName = formatDisplayName({
      handle: dbUser.handle,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      avatar: dbUser.avatar,
    });

    if (roomId) {
      const room = await prisma.chat_room.findUnique({
        where: { id: roomId, },
        include: {
          space: {
            select: {
              id: true,
              user_id: true,
              user: {
                select: {
                  auth_user_id: true,
                  first_name: true,
                  last_name: true,
                  handle: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (!room) {
        return notFoundResponse;
      }

      if (room.customer_id !== dbUser.user_id) {
        return forbiddenResponse;
      }

      const partnerName = formatDisplayName(room.space.user ?? null);

      const message = await prisma.chat_message.create({
        data: {
          content: parsed.data.content,
          room_id: room.id,
          sender_id: dbUser.user_id,
          sender_role: 'customer',
        },
      });

      try {
        await createMessageNotification({
          recipientAuthId: room.space.user?.auth_user_id,
          href: `/partner/messages/${room.id}`,
          senderLabel: customerName ?? 'Customer',
          content: parsed.data.content,
        });
      } catch (notificationError) {
        console.error('Failed to create chat notification for partner', {
          roomId: room.id,
          error: notificationError,
        });
      }

      return NextResponse.json({
        roomId: room.id,
        message: mapChatMessage(message, customerName, partnerName),
      }, { status: 201, });
    }

    if (!spaceId) {
      return NextResponse.json({ error: 'Invalid request payload.', }, { status: 400, });
    }

    const space = await prisma.space.findUnique({
      where: { id: spaceId, },
      select: {
        id: true,
        user_id: true,
        user: {
          select: {
            auth_user_id: true,
            first_name: true,
            last_name: true,
            handle: true,
            avatar: true,
          },
        },
      },
    });

    if (!space) {
      return notFoundResponse;
    }

    let room = await prisma.chat_room.findFirst({
      where: {
        space_id: spaceId,
        customer_id: dbUser.user_id,
      },
    });

    if (!room) {
      room = await prisma.chat_room.create({
        data: {
          space_id: spaceId,
          customer_id: dbUser.user_id,
        },
      });
    }

    const partnerName = formatDisplayName(space.user ?? null);

    const message = await prisma.chat_message.create({
      data: {
        content: parsed.data.content,
        room_id: room.id,
        sender_id: dbUser.user_id,
        sender_role: 'customer',
      },
    });

    try {
      await createMessageNotification({
        recipientAuthId: space.user?.auth_user_id,
        href: `/partner/messages/${room.id}`,
        senderLabel: customerName ?? 'Customer',
        content: parsed.data.content,
      });
    } catch (notificationError) {
      console.error('Failed to create chat notification for partner', {
        roomId: room.id,
        error: notificationError,
      });
    }

    return NextResponse.json({
      roomId: room.id,
      message: mapChatMessage(message, customerName, partnerName),
    }, { status: 201, });
  }

  if (dbUser.role === 'partner') {
    const roomId = parsed.data.room_id;

    if (!roomId) {
      return NextResponse.json({ error: 'Invalid request payload.', }, { status: 400, });
    }

    const room = await prisma.chat_room.findUnique({
      where: { id: roomId, },
      include: {
        user: {
          select: {
            user_id: true,
            auth_user_id: true,
            first_name: true,
            last_name: true,
            handle: true,
            avatar: true,
          },
        },
        space: {
          select: {
            user_id: true,
            user: {
              select: {
                first_name: true,
                last_name: true,
                handle: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return notFoundResponse;
    }

    if (!room.space || room.space.user_id !== dbUser.user_id) {
      return forbiddenResponse;
    }

    const customerName = formatDisplayName(room.user);
    const partnerName = formatDisplayName(room.space.user ?? null);

    const message = await prisma.chat_message.create({
      data: {
        content: parsed.data.content,
        room_id: room.id,
        sender_id: dbUser.user_id,
        sender_role: 'partner',
      },
    });

    try {
      await createMessageNotification({
        recipientAuthId: room.user.auth_user_id,
        href: `/customer/messages/${room.id}`,
        senderLabel: partnerName ?? 'Host',
        content: parsed.data.content,
      });
    } catch (notificationError) {
      console.error('Failed to create chat notification for customer', {
        roomId: room.id,
        error: notificationError,
      });
    }

    return NextResponse.json({
      roomId: room.id,
      message: mapChatMessage(message, customerName, partnerName),
    }, { status: 201, });
  }

  return forbiddenResponse;
}
