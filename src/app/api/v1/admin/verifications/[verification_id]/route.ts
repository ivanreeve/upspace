import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { verificationActionSchema } from '@/lib/validations/admin';
import { resolveSignedImageUrls } from '@/lib/spaces/image-urls';

type RouteContext = {
  params: Promise<{ verification_id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminSession(req);
    const { verification_id, } = await context.params;

    const verification = await prisma.verification.findUnique({
      where: { id: verification_id, },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
            description: true,
            space_image: {
              orderBy: { display_order: 'asc', },
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

    if (!verification) {
      return NextResponse.json({ error: 'Verification not found.', }, { status: 404, });
    }

    const signedUrlMap = await resolveSignedImageUrls(verification.verification_document);

    const payload = {
      id: verification.id,
      status: verification.status,
      submitted_at: verification.submitted_at.toISOString(),
      reviewed_at: verification.reviewed_at?.toISOString() ?? null,
      rejected_reason: verification.rejected_reason,
      space: {
        id: verification.space.id,
        name: verification.space.name,
        location: `${verification.space.city}, ${verification.space.region}`,
        description: verification.space.description,
        partner: {
          handle: verification.space.user.handle,
          name: [verification.space.user.first_name, verification.space.user.last_name]
            .filter(Boolean)
            .join(' ') || verification.space.user.handle,
        },
      },
      documents: verification.verification_document.map((doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        mime_type: doc.mime_type,
        file_size_bytes: Number(doc.file_size_bytes),
        status: doc.status,
        url: signedUrlMap.get(doc.path) ?? null,
      })),
    };

    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to load verification', error);
    return NextResponse.json({ error: 'Failed to load verification.', }, { status: 500, });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminSession(req);
    const { verification_id, } = await context.params;

    const body = await req.json().catch(() => null);
    const parsed = verificationActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const {
      action,
      rejected_reason,
      valid_until,
    } = parsed.data;
    const now = new Date();
    const validUntilDate =
      action === 'approve' && valid_until ? new Date(valid_until) : null;

    const verification = await prisma.verification.findUnique({
      where: { id: verification_id, },
      select: {
 id: true,
status: true, 
},
    });

    if (!verification) {
      return NextResponse.json({ error: 'Verification not found.', }, { status: 404, });
    }

    const updated = await prisma.verification.update({
      where: { id: verification_id, },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: now,
        approved_at: action === 'approve' ? now : null,
        rejected_at: action === 'reject' ? now : null,
        rejected_reason: action === 'reject' ? rejected_reason : null,
        valid_until: action === 'approve' ? validUntilDate : null,
        updated_at: now,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.status,
        reviewed_at: updated.reviewed_at?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to update verification', error);
    return NextResponse.json({ error: 'Failed to update verification.', }, { status: 500, });
  }
}
