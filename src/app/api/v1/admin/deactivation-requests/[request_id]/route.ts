import { NextRequest, NextResponse } from 'next/server';
import { user_status } from '@prisma/client';
import { z } from 'zod';

import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { prisma } from '@/lib/prisma';
import { sendDeactivationRejectionEmail } from '@/lib/email';

const DEACTIVATION_APPROVED_METADATA_KEY = 'deactivation_approved_at';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.action === 'reject') {
    const reason = data.rejection_reason?.trim();
    if (!reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A rejection reason is required.',
      });
    }
  }
});

export async function PATCH(
  req: NextRequest,
  { params, }: { params: { request_id: string } }
) {
  try {
    const session = await requireAdminSession();

    const parsedBody = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.flatten(), },
        { status: 400, }
      );
    }

    const parsedId = z.string().uuid().safeParse(params.request_id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid request identifier.', },
        { status: 400, }
      );
    }

    const request = await prisma.deactivation_request.findUnique({
      where: { id: parsedId.data, },
      include: { user_deactivation_request_user_idTouser: { select: { user_id: true, }, }, },
    });

    if (!request) {
      return NextResponse.json(
        { error: 'Deactivation request not found.', },
        { status: 404, }
      );
    }

    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed.', },
        { status: 400, }
      );
    }

    const now = new Date();

    if (parsedBody.data.action === 'approve') {
      await prisma.$transaction([
        prisma.deactivation_request.update({
          where: { id: request.id, },
          data: {
            status: 'approved',
            processed_at: now,
            processed_by_user_id: session.userId,
          },
        }),
        prisma.user.update({
          where: { user_id: request.user_deactivation_request_user_idTouser.user_id, },
          data: {
            status: user_status.deactivated,
            cancelled_at: now,
            pending_deletion_at: null,
            expires_at: null,
            deleted_at: null,
          },
        })
      ]);

      const metadataPayload = JSON.stringify({ [DEACTIVATION_APPROVED_METADATA_KEY]: now.toISOString(), });

      await prisma.$executeRaw`
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || ${metadataPayload}::jsonb
        WHERE id = ${request.auth_user_id}::uuid
      `;

      return NextResponse.json({ status: 'approved', });
    }

    const rejectionReason = parsedBody.data.rejection_reason?.trim() ?? '';

    await prisma.deactivation_request.update({
      where: { id: request.id, },
      data: {
        status: 'rejected',
        rejection_reason: rejectionReason,
        processed_at: now,
        processed_by_user_id: session.userId,
      },
    });

    await sendDeactivationRejectionEmail({
      to: request.email,
      reason: rejectionReason,
    });

    return NextResponse.json({ status: 'rejected', });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }
    console.error('Failed to process deactivation request', error);
    return NextResponse.json(
      { error: 'Unable to process the deactivation request.', },
      { status: 500, }
    );
  }
}
