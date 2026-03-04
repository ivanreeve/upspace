import { NextResponse } from 'next/server';

import { normalizeNumeric } from '@/lib/bookings/serializer';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: authData, error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Authentication required.', },
        { status: 401, }
      );
    }

    const authUserId = authData.user.id;

    const user = await prisma.user.findFirst({
      where: { auth_user_id: authUserId, },
      select: {
        user_id: true,
        auth_user_id: true,
        role: true,
        status: true,
        first_name: true,
        last_name: true,
        handle: true,
        avatar: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found.', },
        { status: 404, }
      );
    }

    const [bookings, notifications, reviews, chatRooms] = await Promise.all([
      prisma.booking.findMany({
        where: { user_auth_id: authUserId, },
        orderBy: { created_at: 'desc', },
        select: {
          id: true,
          space_name: true,
          area_name: true,
          booking_hours: true,
          start_at: true,
          expires_at: true,
          guest_count: true,
          price_minor: true,
          currency: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.app_notification.findMany({
        where: { user_auth_id: authUserId, },
        orderBy: { created_at: 'desc', },
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          read_at: true,
          created_at: true,
        },
      }),
      prisma.review.findMany({
        where: { user_id: user.user_id, },
        orderBy: { created_at: 'desc', },
        select: {
          id: true,
          space_id: true,
          rating_star: true,
          description: true,
          created_at: true,
        },
      }),
      prisma.chat_room.findMany({
        where: { customer_id: user.user_id, },
        orderBy: { created_at: 'desc', },
        select: {
          id: true,
          space_id: true,
          created_at: true,
          chat_message: {
            where: { sender_id: user.user_id, },
            orderBy: { created_at: 'desc', },
            select: {
              id: true,
              content: true,
              created_at: true,
            },
          },
        },
      })
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: {
        userId: user.user_id.toString(),
        role: user.role,
        status: user.status,
        firstName: user.first_name,
        lastName: user.last_name,
        handle: user.handle,
        avatar: user.avatar,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
      },
      bookings: bookings.map((b) => ({
        id: b.id,
        spaceName: b.space_name,
        areaName: b.area_name,
        bookingHours: normalizeNumeric(b.booking_hours),
        startAt: b.start_at.toISOString(),
        expiresAt: b.expires_at?.toISOString() ?? null,
        guestCount: b.guest_count,
        priceMinor: b.price_minor?.toString() ?? null,
        currency: b.currency,
        status: b.status,
        createdAt: b.created_at.toISOString(),
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        readAt: n.read_at?.toISOString() ?? null,
        createdAt: n.created_at.toISOString(),
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        spaceId: r.space_id,
        rating: Number(r.rating_star),
        description: r.description,
        createdAt: r.created_at.toISOString(),
      })),
      chatMessages: chatRooms.flatMap((room) =>
        room.chat_message.map((m) => ({
          roomId: room.id,
          messageId: m.id,
          content: m.content,
          createdAt: m.created_at.toISOString(),
        }))
      ),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="upspace-data-export-${authUserId.slice(0, 8)}.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to export user data', error);
    return NextResponse.json(
      { error: 'Unable to export your data.', },
      { status: 500, }
    );
  }
}
