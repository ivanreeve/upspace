import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEACTIVATION_METADATA_KEY = 'deactivation_requested_at';

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
      select: { user_id: true, },
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

    const hasPendingRequest = await prisma.deactivation_request.findFirst({
      where: {
        auth_user_id: authUser.id,
        status: 'pending',
      },
    });

    if (hasPendingRequest) {
      return NextResponse.json(
        { message: 'You already have a pending deactivation request in review.', },
        { status: 400, }
      );
    }

    await prisma.deactivation_request.create({
      data: {
        user_id: existingUser.user_id,
        auth_user_id: authUser.id,
        email,
        reason_category,
        custom_reason: trimmedReason,
      },
    });

    const metadataPayload = JSON.stringify({ [DEACTIVATION_METADATA_KEY]: new Date().toISOString(), });

    await prisma.$executeRaw`
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || ${metadataPayload}::jsonb
      WHERE id = ${authUser.id}::uuid
    `;

    return NextResponse.json({ status: 'requested', });
  } catch (error) {
    console.error('Failed to deactivate account', error);
    return NextResponse.json(
      { message: 'Unable to deactivate your account at the moment.', },
      { status: 500, }
    );
  }
}
