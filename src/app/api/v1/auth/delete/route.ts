import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  deactivation_reason_category,
  deactivation_request_status,
  deactivation_request_type,
  user_role,
  user_status
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DELETION_GRACE_DAYS = 30;
const deletionReasonSchema = z.enum([
  'not_using',
  'pricing',
  'privacy',
  'switching',
  'other'
]);

const requestBodySchema = z.object({
  reason_category: deletionReasonSchema,
  custom_reason: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
 data: authData, error: authError, 
} = await supabase.auth.getUser();

    if (authError) {
      console.error('Unable to verify session for deletion', authError);
      return NextResponse.json(
        { message: 'Unable to verify your session.', },
        { status: 500, }
      );
    }

    const authUser = authData.user;

    if (!authUser) {
      return NextResponse.json(
        { message: 'Authentication required.', },
        { status: 401, }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { auth_user_id: authUser.id, },
      select: {
        user_id: true,
        role: true,
        status: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { message: 'Unable to locate your profile.', },
        { status: 404, }
      );
    }

    if (existingUser.status === user_status.deleted) {
      return NextResponse.json(
        { message: 'This account has already been deleted.', },
        { status: 400, }
      );
    }

    if (existingUser.status === user_status.pending_deletion) {
      return NextResponse.json(
        { message: 'Account deletion is already scheduled.', },
        { status: 400, }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const parsed = requestBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Please provide a reason for deletion.', },
        { status: 400, }
      );
    }

    const {
 reason_category, custom_reason, 
} = parsed.data;
    const trimmedReason = custom_reason?.trim() ?? null;
    if (reason_category === 'other' && !trimmedReason) {
      return NextResponse.json(
        { message: 'Please share a little more about why you are leaving.', },
        { status: 400, }
      );
    }

    // Partners require admin approval.
    if (existingUser.role === user_role.partner) {
      const hasPendingDelete = await prisma.deactivation_request.findFirst({
        where: {
          auth_user_id: authUser.id,
          status: deactivation_request_status.pending,
          type: deactivation_request_type.delete,
        },
      });

      if (hasPendingDelete) {
        return NextResponse.json(
          { message: 'You already have a pending deletion request in review.', },
          { status: 400, }
        );
      }

      await prisma.deactivation_request.create({
        data: {
          user_id: existingUser.user_id,
          auth_user_id: authUser.id,
          email: authUser.email ?? '',
          reason_category: reason_category as deactivation_reason_category,
          custom_reason: trimmedReason,
          type: deactivation_request_type.delete,
          status: deactivation_request_status.pending,
        },
      });

      return NextResponse.json({
        status: 'requested',
        role: existingUser.role,
      });
    }

    // Customers: immediate 30-day pending deletion + audit entry.
    const now = new Date();
    const deadline = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { auth_user_id: authUser.id, },
      data: {
        status: user_status.pending_deletion,
        pending_deletion_at: now,
        expires_at: deadline,
        deleted_at: null,
        cancelled_at: null,
      },
    });

    await prisma.deactivation_request.create({
      data: {
        user_id: existingUser.user_id,
        auth_user_id: authUser.id,
        email: authUser.email ?? '',
        reason_category: reason_category as deactivation_reason_category,
        custom_reason: trimmedReason,
        type: deactivation_request_type.delete,
        status: deactivation_request_status.approved,
        processed_at: now,
      },
    });

    return NextResponse.json({
      status: 'scheduled',
      reactivationDeadline: deadline.toISOString(),
    });
  } catch (error) {
    console.error('Failed to schedule account deletion', error);
    return NextResponse.json(
      { message: 'Unable to delete your account at the moment.', },
      { status: 500, }
    );
  }
}
