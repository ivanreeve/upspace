import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { invalidateSpacesListCache } from '@/lib/cache/redis';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().trim().max(1000).optional(),
}).superRefine((values, ctx) => {
  if (values.action === 'reject') {
    const reason = values.rejection_reason?.trim();
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
  { params, }: { params: Promise<{ request_id: string }> }
) {
  const resolvedParams = await params;
  try {
    const session = await requireAdminSession(req);

    const parsedId = z.string().uuid().safeParse(resolvedParams.request_id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid request identifier.', }, { status: 400, });
    }

    const parsedBody = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten(), }, { status: 400, });
    }

    const request = await prisma.unpublish_request.findUnique({
      where: { id: parsedId.data, },
      include: {
 space: {
 select: {
 id: true,
is_published: true, 
}, 
}, 
},
    });

    if (!request) {
      return NextResponse.json({ error: 'Unpublish request not found.', }, { status: 404, });
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been processed.', }, { status: 400, });
    }

    const now = new Date();

    if (parsedBody.data.action === 'approve') {
      await prisma.$transaction([
        prisma.unpublish_request.update({
          where: { id: request.id, },
          data: {
            status: 'approved',
            processed_at: now,
            processed_by_user_id: session.userId,
          },
        }),
        prisma.space.update({
          where: { id: request.space_id, },
          data: {
            is_published: false,
            unpublished_at: now,
            unpublished_reason: request.reason,
            unpublished_by_admin: false,
            updated_at: now,
          },
        })
      ]);

      await invalidateSpacesListCache();
      return NextResponse.json({ status: 'approved', });
    }

    const rejectionReason = parsedBody.data.rejection_reason?.trim() ?? '';

    await prisma.unpublish_request.update({
      where: { id: request.id, },
      data: {
        status: 'rejected',
        rejection_reason: rejectionReason,
        processed_at: now,
        processed_by_user_id: session.userId,
        updated_at: now,
      },
    });

    return NextResponse.json({ status: 'rejected', });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to process unpublish request', error);
    return NextResponse.json({ error: 'Unable to process the unpublish request.', }, { status: 500, });
  }
}
