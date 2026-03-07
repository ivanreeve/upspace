import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { adminComplaintActionSchema } from '@/lib/validations/complaint';
import { notifyComplaintResolvedByAdmin, notifyComplaintDismissedByAdmin } from '@/lib/notifications/complaint';

export async function PATCH(
  req: NextRequest,
  { params, }: { params: Promise<{ complaint_id: string }> }
) {
  const resolvedParams = await params;

  try {
    const session = await requireAdminSession(req);

    const parsedId = z.string().uuid().safeParse(resolvedParams.complaint_id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid complaint identifier.', }, { status: 400, });
    }

    const parsedBody = adminComplaintActionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error:
            parsedBody.error.issues[0]?.message ??
            'Invalid complaint action payload.',
        },
        { status: 400, }
      );
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: parsedId.data, },
      select: {
        id: true,
        status: true,
        customer_auth_id: true,
        partner_auth_id: true,
        booking: {
          select: {
            id: true,
            space_id: true,
            space_name: true,
            area_id: true,
            area_name: true,
          },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found.', }, { status: 404, });
    }

    if (complaint.status !== 'escalated') {
      return NextResponse.json(
        { error: 'Only escalated complaints can be processed by admins.', },
        { status: 400, }
      );
    }

    const now = new Date();
    const isResolve = parsedBody.data.action === 'resolve';
    const nextStatus = isResolve ? 'resolved' : 'dismissed';

    await prisma.complaint.update({
      where: { id: complaint.id, },
      data: {
        status: nextStatus,
        processed_at: now,
        processed_by_user_id: session.userId,
        resolution_note: parsedBody.data.note?.trim() || null,
        updated_at: now,
      },
    });

    const notificationContext = {
      bookingId: complaint.booking.id,
      spaceId: complaint.booking.space_id,
      areaId: complaint.booking.area_id,
      spaceName: complaint.booking.space_name,
      areaName: complaint.booking.area_name,
      customerAuthId: complaint.customer_auth_id,
      partnerAuthId: complaint.partner_auth_id,
    };

    if (isResolve) {
      await notifyComplaintResolvedByAdmin(notificationContext).catch(() => {});
    } else {
      await notifyComplaintDismissedByAdmin(notificationContext).catch(() => {});
    }

    return NextResponse.json({ status: nextStatus, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to process complaint', error);
    return NextResponse.json(
      { error: 'Unable to process the complaint.', },
      { status: 500, }
    );
  }
}
