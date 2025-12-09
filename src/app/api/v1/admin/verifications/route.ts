import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma, verification_status } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { resolveSignedImageUrls } from '@/lib/spaces/image-urls';

const querySchema = z.object({
  status: z.enum(['draft', 'in_review', 'approved', 'rejected', 'expired']).default('in_review'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = querySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const {
 status, limit, cursor, 
} = parsed.data;
    const now = new Date();
    const where: Prisma.verificationWhereInput =
      status === 'expired'
        ? {
          subject_type: 'space',
          OR: [
            { status: 'expired' as verification_status, },
            {
              status: 'approved' as verification_status,
              valid_until: { lt: now, },
            }
          ],
        }
        : {
          subject_type: 'space',
          status: status as verification_status,
        };

    const verifications = await prisma.verification.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy: { submitted_at: 'asc', },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
            is_published: true,
            unpublished_at: true,
            unpublished_reason: true,
            unpublished_by_admin: true,
            space_image: {
              where: { is_primary: 1, },
              take: 1,
              select: { path: true, },
            },
            user: {
              select: {
                handle: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        verification_document: {
          select: {
            id: true,
            path: true,
            document_type: true,
            mime_type: true,
            file_size_bytes: true,
            status: true,
          },
        },
      },
    });

    const hasNext = verifications.length > limit;
    const items = hasNext ? verifications.slice(0, limit) : verifications;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const allDocuments = items.flatMap((v) => v.verification_document);
    const signedUrlMap = await resolveSignedImageUrls(allDocuments);

    const payload = items.map((v) => ({
      id: v.id,
      status: v.status,
      submitted_at: v.submitted_at.toISOString(),
      reviewed_at: v.reviewed_at?.toISOString() ?? null,
      rejected_reason: v.rejected_reason,
      space: {
        id: v.space.id,
        name: v.space.name,
        location: `${v.space.city}, ${v.space.region}`,
        image_url: v.space.space_image[0]?.path ?? null,
        is_published: v.space.is_published,
        unpublished_at: v.space.unpublished_at?.toISOString() ?? null,
        unpublished_reason: v.space.unpublished_reason,
        unpublished_by_admin: v.space.unpublished_by_admin,
        partner: {
          handle: v.space.user.handle,
          name: [v.space.user.first_name, v.space.user.last_name].filter(Boolean).join(' ') || v.space.user.handle,
        },
      },
      documents: v.verification_document.map((doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        mime_type: doc.mime_type,
        file_size_bytes: Number(doc.file_size_bytes),
        status: doc.status,
        url: signedUrlMap.get(doc.path) ?? null,
      })),
    }));

    return NextResponse.json({
 data: payload,
nextCursor, 
});
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to list verifications', error);
    return NextResponse.json({ error: 'Unable to load verifications.', }, { status: 500, });
  }
}
