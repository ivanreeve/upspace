import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
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

const invalidPayloadResponse = NextResponse.json(
  { error: 'Invalid request payload.', },
  { status: 400, }
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = chatMessageRoomQuerySchema.safeParse({ room_id: url.searchParams.get('room_id') ?? undefined, });

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
      customer: {
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
      messages: { orderBy: { created_at: 'asc', }, },
    },
  });

  if (!room) {
    return notFoundResponse;
  }

  if (dbUser.role === 'customer') {
    if (room.customer.user_id !== dbUser.user_id) {
      return forbiddenResponse;
    }
  } else if (dbUser.role === 'partner') {
    if (!room.space || room.space.user_id !== dbUser.user_id) {
      return forbiddenResponse;
    }
  } else {
    return forbiddenResponse;
  }

  const customerName = formatDisplayName(room.customer);
  const partnerName = formatDisplayName(room.space?.user ?? null);

  const messages = room.messages.map((message) =>
    mapChatMessage(message, customerName, partnerName)
  );

  return NextResponse.json({ messages, });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = chatMessagePayloadSchema.safeParse(body ?? {});

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

    if (!spaceId) {
      return invalidPayloadResponse;
    }

    const space = await prisma.space.findUnique({
      where: { id: spaceId, },
      select: {
        id: true,
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

    const customerName = formatDisplayName({
      handle: dbUser.handle,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      avatar: dbUser.avatar,
    });

    const partnerName = formatDisplayName(space.user ?? null);

    const message = await prisma.chat_message.create({
      data: {
        content: parsed.data.content,
        room_id: room.id,
        sender_id: dbUser.user_id,
        sender_role: 'customer',
      },
    });

    return NextResponse.json({
      roomId: room.id,
      message: mapChatMessage(message, customerName, partnerName),
    }, { status: 201, });
  }

  if (dbUser.role === 'partner') {
    const roomId = parsed.data.room_id;

    if (!roomId) {
      return invalidPayloadResponse;
    }

    const room = await prisma.chat_room.findUnique({
      where: { id: roomId, },
      include: {
        customer: {
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

    if (!room.space || room.space.user_id !== dbUser.user_id) {
      return forbiddenResponse;
    }

    const customerName = formatDisplayName(room.customer);
    const partnerName = formatDisplayName(room.space.user ?? null);

    const message = await prisma.chat_message.create({
      data: {
        content: parsed.data.content,
        room_id: room.id,
        sender_id: dbUser.user_id,
        sender_role: 'partner',
      },
    });

    return NextResponse.json({
      roomId: room.id,
      message: mapChatMessage(message, customerName, partnerName),
    }, { status: 201, });
  }

  return forbiddenResponse;
}
