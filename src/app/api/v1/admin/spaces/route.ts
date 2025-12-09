import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { formatUserDisplayName } from '@/lib/user/display-name';

const querySchema = z.object({
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const rawSearch = searchParams.get('search');
    const trimmedSearch = rawSearch?.trim() ?? '';
    const parsed = querySchema.safeParse({
      search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), },
        { status: 400, }
      );
    }

    const {
 search, limit, cursor, 
} = parsed.data;
    const searchClause = search
      ? {
          OR: [
            {
 name: {
 contains: search,
mode: 'insensitive', 
}, 
},
            {
 city: {
 contains: search,
mode: 'insensitive', 
}, 
},
            {
 region: {
 contains: search,
mode: 'insensitive', 
}, 
},
            {
 street: {
 contains: search,
mode: 'insensitive', 
}, 
},
            {
 unit_number: {
 contains: search,
mode: 'insensitive', 
}, 
}
          ],
        }
      : {};

    const spaces = await prisma.space.findMany({
      where: searchClause,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor, }, } : {}),
      orderBy: { id: 'asc', },
      select: {
        id: true,
        name: true,
        city: true,
        region: true,
        is_published: true,
        unpublished_at: true,
        unpublished_by_admin: true,
        updated_at: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            handle: true,
          },
        },
      },
    });

    const hasNext = spaces.length > limit;
    const items = hasNext ? spaces.slice(0, limit) : spaces;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((space) => ({
      id: space.id,
      name: space.name,
      ownerName: formatUserDisplayName(
        space.user?.first_name,
        space.user?.last_name,
        space.user?.handle ?? undefined
      ),
      city: space.city,
      region: space.region,
      isPublished: space.is_published,
      unpublishedAt: space.unpublished_at?.toISOString() ?? null,
      unpublishedByAdmin: space.unpublished_by_admin,
      updatedAt: space.updated_at?.toISOString() ?? null,
    }));

    return NextResponse.json({
      data: payload,
      nextCursor,
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to list spaces', error);
    return NextResponse.json(
      { error: 'Unable to load spaces.', },
      { status: 500, }
    );
  }
}
