import { NextRequest, NextResponse } from 'next/server';
import { user_status } from '@prisma/client';
import { z } from 'zod';

import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { prisma } from '@/lib/prisma';

const paramsSchema = z.object({
  user_id: z
    .string()
    .regex(/^[0-9]+$/, 'Invalid user identifier.')
    .transform((value) => BigInt(value)),
});

const bodySchema = z.object({ reason: z.string().trim().max(500).optional(), });

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ user_id: string }> }
) {
  const params = await context.params;
  try {
    await requireAdminSession(req);
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return NextResponse.json(
        { error: parsedParams.error.flatten(), },
        { status: 400, }
      );
    }

    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.flatten(), },
        { status: 400, }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { user_id: parsedParams.data.user_id, },
      select: {
        user_id: true,
        auth_user_id: true,
        status: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.', }, { status: 404, });
    }

    if (targetUser.status !== user_status.active) {
      return NextResponse.json(
        { error: 'User must be active before disabling.', },
        { status: 400, }
      );
    }

    const now = new Date();
    const metadataPayload = JSON.stringify({
      admin_disabled_at: now.toISOString(),
      admin_disabled_reason: parsedBody.data.reason ?? null,
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { user_id: targetUser.user_id, },
        data: {
          status: user_status.deactivated,
          cancelled_at: now,
          pending_deletion_at: null,
          expires_at: null,
          deleted_at: null,
        },
      }),
      prisma.$executeRaw`
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || ${metadataPayload}::jsonb
        WHERE id = ${targetUser.auth_user_id}::uuid
      `
    ]);

    return NextResponse.json({ status: 'deactivated', });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to disable user', error);
    return NextResponse.json(
      { error: 'Unable to disable user account.', },
      { status: 500, }
    );
  }
}
