import type { Prisma, verification_status } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { resolveImageUrl, resolveSignedImageUrls } from '@/lib/spaces/image-urls';

const SIMILARITY_THRESHOLD = 0.12;

const querySchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters.'),
  limit: z.coerce.number().int().min(1).max(15).default(8),
  include_pending: z.coerce.boolean().optional().default(false),
});

type SuggestionRow = {
  id: string;
  name: string;
  city: string;
  region: string;
  country_code: string;
  similarity: number;
  image_path: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams, } = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: searchParams.get('q'),
    limit: searchParams.get('limit') ?? undefined,
    include_pending: searchParams.get('include_pending') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten(), },
      { status: 400, }
    );
  }

  const {
    q,
    limit,
    include_pending,
  } = parsed.data;
  const normalizedQuery = q.toLowerCase();
  const verificationStatuses: verification_status[] = include_pending
    ? ['approved', 'in_review']
    : ['approved'];

    try {
      await enforceRateLimit({
        scope: 'spaces-suggest',
        request: req,
      });
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return NextResponse.json(
          { error: error.message, },
          {
            status: 429,
            headers: { 'Retry-After': error.retryAfter.toString(), },
          }
        );
      }

      console.error('Space suggestion rate limit check failed', error);
      return NextResponse.json(
        { error: 'Failed to fetch space suggestions', },
        { status: 500, }
      );
    }

  try {
    const rows = await prisma.$queryRaw<SuggestionRow[]>`
      SELECT
        s.id,
        s.name,
        s.city,
        s.region,
        s.country_code,
        si.path AS image_path,
        similarity(lower(s.name), ${normalizedQuery}) AS similarity
      FROM "space" s
      LEFT JOIN LATERAL (
        SELECT path
        FROM space_image
        WHERE space_id = s.id
        ORDER BY is_primary DESC, display_order ASC, created_at ASC
        LIMIT 1
      ) si ON true
      WHERE similarity(lower(s.name), ${normalizedQuery}) >= ${SIMILARITY_THRESHOLD}
        AND EXISTS (
          SELECT 1
          FROM verification v
          WHERE v.space_id = s.id
            AND v.status = ANY(${verificationStatuses}::verification_status[])
        )
        AND s.is_published = true
      ORDER BY similarity DESC, s.name ASC
      LIMIT ${limit};
    `;

    const signedImageUrlMap = await resolveSignedImageUrls(rows.map((row) => ({ path: row.image_path, })));

    const suggestions = rows.map((row) => ({
      space_id: row.id,
      name: row.name,
      image_url: resolveImageUrl(row.image_path, signedImageUrlMap),
      location: [row.city, row.region, row.country_code].filter(Boolean).join(', ') || null,
      similarity: Number(row.similarity ?? 0),
    }));

    return NextResponse.json({ suggestions, });
  } catch (error) {
    console.error('Failed to fetch space suggestions via trigram query', error);

    try {
      const fallbackRows = await prisma.$queryRaw<SuggestionRow[]>`
        SELECT
          s.id,
          s.name,
          s.city,
          s.region,
          s.country_code,
          si.path AS image_path,
          0::float AS similarity
        FROM "space" s
        LEFT JOIN LATERAL (
          SELECT path
          FROM space_image
          WHERE space_id = s.id
          ORDER BY is_primary DESC, display_order ASC, created_at ASC
          LIMIT 1
        ) si ON true
        WHERE lower(s.name) LIKE ${`%${normalizedQuery}%`}
          AND EXISTS (
            SELECT 1
            FROM verification v
            WHERE v.space_id = s.id
              AND v.status = ANY(${verificationStatuses}::verification_status[])
          )
          AND s.is_published = true
        ORDER BY s.name ASC
        LIMIT ${limit};
      `;

      const signedImageUrlMap = await resolveSignedImageUrls(fallbackRows.map((row) => ({ path: row.image_path, })));

      const suggestions = fallbackRows.map((row) => ({
        space_id: row.id,
        name: row.name,
        image_url: resolveImageUrl(row.image_path, signedImageUrlMap),
        location: [row.city, row.region, row.country_code].filter(Boolean).join(', ') || null,
        similarity: Number(row.similarity ?? 0),
      }));

      return NextResponse.json({
        suggestions,
        fallback: true,
      });
    } catch (fallbackError) {
      console.error('Fallback suggestion query failed', fallbackError);
      return NextResponse.json({ error: 'Failed to fetch space suggestions', }, { status: 500, });
    }
  }
}
