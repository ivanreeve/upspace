import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { chatRoomQuerySchema } from '@/lib/validations/chat';
import { formatDisplayName, mapChatMessage, resolveAvatarUrl } from '@/lib/chat/utils';
import type { ChatRoomDetail, ChatRoomSummary } from '@/types/chat';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

const invalidSpaceResponse = NextResponse.json(
  { error: 'Invalid space identifier.', },
  { status: 400, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Resource not found.', },
  { status: 404, }
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = chatRoomQuerySchema.safeParse({ space_id: url.searchParams.get('space_id') ?? undefined, });

  if (!parsed.success) {
    return invalidSpaceResponse;
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
    const { space_id, } = parsed.data;

    if (!space_id) {
      return invalidSpaceResponse;
    }

    const space = await prisma.space.findUnique({
      where: { id: space_id, },
      select: {
        id: true,
        name: true,
        city: true,
        region: true,
        user_id: true,
      },
    });

    if (!space) {
      return notFoundResponse;
    }

    const room = await prisma.chat_room.findFirst({
      where: {
        space_id,
        customer_id: dbUser.user_id,
      },
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
            id: true,
            name: true,
            city: true,
            region: true,
            user_id: true,
            user: {
              select: {
                user_id: true,
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
      return NextResponse.json({ room: null, });
    }

    const customerName = formatDisplayName(room.customer);
    const partnerName = formatDisplayName(room.space.user ?? null);
    const messages = room.messages.map((message) =>
      mapChatMessage(message, customerName, partnerName)
    );

    const response: ChatRoomDetail = {
      id: room.id,
      spaceId: room.space.id,
      spaceName: room.space.name,
      spaceCity: room.space.city ?? null,
      spaceRegion: room.space.region ?? null,
      customerId: room.customer.user_id.toString(),
      customerName,
      customerHandle: room.customer.handle,
      customerAvatarUrl: resolveAvatarUrl(room.customer.avatar),
      partnerId: (room.space.user?.user_id ?? room.space.user_id).toString(),
      partnerName,
      partnerAvatarUrl: resolveAvatarUrl(room.space.user?.avatar ?? null),
      lastMessage: messages.at(-1) ?? null,
      createdAt: room.created_at.toISOString(),
      messages,
    };

    return NextResponse.json({ room: response, });
  }

  if (dbUser.role === 'partner') {
    const rooms = await prisma.chat_room.findMany({
      where: { space: { user_id: dbUser.user_id, }, },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
        customer: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            handle: true,
            avatar: true,
          },
        },
        messages: {
          orderBy: { created_at: 'desc', },
          take: 1,
        },
      },
    });

    const partnerName = formatDisplayName({
      handle: dbUser.handle,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      avatar: dbUser.avatar,
    });
    const partnerAvatarUrl = resolveAvatarUrl(dbUser.avatar);

    const summaries = rooms.map((room) => {
      const customerName = formatDisplayName(room.customer);
      const lastMessage = room.messages[0]
        ? mapChatMessage(room.messages[0], customerName, partnerName)
        : null;

      const summary: ChatRoomSummary = {
        id: room.id,
        spaceId: room.space.id,
        spaceName: room.space.name,
        spaceCity: room.space.city ?? null,
        spaceRegion: room.space.region ?? null,
        customerId: room.customer.user_id.toString(),
        customerName,
        customerHandle: room.customer.handle,
        customerAvatarUrl: resolveAvatarUrl(room.customer.avatar),
        partnerId: dbUser.user_id.toString(),
        partnerName,
        partnerAvatarUrl,
        lastMessage,
        createdAt: room.created_at.toISOString(),
      };

      return summary;
    });

    const sorted = summaries.sort((a, b) => {
      const aKey = a.lastMessage?.createdAt ?? a.createdAt;
      const bKey = b.lastMessage?.createdAt ?? b.createdAt;
      if (aKey === bKey) {
        return 0;
      }
      return aKey > bKey ? -1 : 1;
    });

    return NextResponse.json({ rooms: sorted, });
  }

  return forbiddenResponse;
}
