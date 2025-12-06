import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
deactivation_request_type,
deactivation_request_status,
user_role,
user_status
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const deactivationReasonSchema = z.enum([
  'not_using',
  'pricing',
  'privacy',
  'switching',
  'other'
]);

const requestBodySchema = z.object({
  reason_category: deactivationReasonSchema,
  custom_reason: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Unable to verify session for deactivation', authError);
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

    const payload = await req.json().catch(() => ({}));
    const parsed = requestBodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Please select a reason for deactivating your account.', },
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

    const email = authUser.email;
    if (!email) {
      return NextResponse.json(
        { message: 'Unable to retrieve your email address.', },
        { status: 400, }
      );
    }

    if (existingUser.status === user_status.deactivated) {
      return NextResponse.json(
        { message: 'Your account is already deactivated.', },
        { status: 400, }
      );
    }

    if (existingUser.status === user_status.pending_deletion || existingUser.status === user_status.deleted) {
      return NextResponse.json(
        { message: 'Account deletion is in progress or completed.', },
        { status: 400, }
      );
    }

    const hasPendingRequest = await prisma.deactivation_request.findFirst({
      where: {
        auth_user_id: authUser.id,
        status: deactivation_request_status.pending,
        type: deactivation_request_type.deactivate,
      },
    });

    if (hasPendingRequest) {
      return NextResponse.json(
        { message: 'You already have a pending deactivation request in review.', },
        { status: 400, }
      );
    }

    // Partner: create pending request for admin approval.
    if (existingUser.role === user_role.partner) {
      await prisma.deactivation_request.create({
        data: {
          user_id: existingUser.user_id,
          auth_user_id: authUser.id,
          email,
          reason_category,
          custom_reason: trimmedReason,
          type: deactivation_request_type.deactivate,
          status: deactivation_request_status.pending,
        },
      });

      return NextResponse.json({
 status: 'requested',
role: existingUser.role, 
});
    }

    // Customer: immediate deactivate + log as approved request for auditing.
    const now = new Date();
    await prisma.$transaction([
      prisma.deactivation_request.create({
        data: {
          user_id: existingUser.user_id,
          auth_user_id: authUser.id,
          email,
          reason_category,
          custom_reason: trimmedReason,
          type: deactivation_request_type.deactivate,
          status: deactivation_request_status.approved,
          processed_at: now,
        },
      }),
      prisma.user.update({
        where: { auth_user_id: authUser.id, },
        data: { status: user_status.deactivated, },
      })
    ]);

    return NextResponse.json({
 status: 'deactivated',
role: existingUser.role, 
});
  } catch (error) {
    console.error('Failed to deactivate account', error);
    return NextResponse.json(
      { message: 'Unable to deactivate your account at the moment.', },
      { status: 500, }
    );
  }
}
