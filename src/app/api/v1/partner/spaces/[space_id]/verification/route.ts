import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { buildPublicObjectUrl, resolveSignedImageUrls } from '@/lib/spaces/image-urls';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type RouteParams = {
  params: Promise<{
    space_id: string;
  }>;
};

export async function GET(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json(
        { error: 'space_id must be a valid UUID.', },
        { status: 400, }
      );
    }

    const space = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      select: { id: true, },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const verification = await prisma.verification.findFirst({
      where: { space_id: space.id, },
      orderBy: { created_at: 'desc', },
      include: {
        verification_document: {
          orderBy: { created_at: 'asc', },
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

    if (!verification || verification.verification_document.length === 0) {
      return NextResponse.json({ data: null, });
    }

    const signedUrlMap = await resolveSignedImageUrls(verification.verification_document);

    const payload = {
      id: verification.id,
      status: verification.status,
      submitted_at: verification.submitted_at?.toISOString() ?? null,
      documents: verification.verification_document.map((doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        mime_type: doc.mime_type,
        file_size_bytes: Number(doc.file_size_bytes ?? 0),
        url: signedUrlMap.get(doc.path) ?? buildPublicObjectUrl(doc.path),
        path: doc.path,
      })),
    };

    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to load partner verification documents', error);
    return NextResponse.json(
      { error: 'Unable to load verification documents.', },
      { status: 500, }
    );
  }
}
