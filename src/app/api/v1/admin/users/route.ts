import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { formatUserDisplayName } from '@/lib/user/display-name';

const querySchema = z.object({
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z
    .string()
    .regex(/^[0-9]+$/, 'Invalid cursor identifier.')
    .transform((value) => BigInt(value))
    .optional(),
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
    const searchClause: Prisma.userWhereInput | undefined = search
      ? {
          OR: [
            {
              handle: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              first_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              last_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            }
          ],
        }
      : undefined;

    const users = await prisma.user.findMany({
      where: searchClause,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { user_id: cursor, }, } : {}),
      orderBy: { user_id: 'asc', },
      select: {
        user_id: true,
        handle: true,
        first_name: true,
        last_name: true,
        role: true,
        status: true,
        created_at: true,
      },
    });

    const hasNext = users.length > limit;
    const items = hasNext ? users.slice(0, limit) : users;
    const nextCursor = hasNext
      ? items[items.length - 1]?.user_id.toString() ?? null
      : null;

    const payload = items.map((user) => ({
      id: user.user_id.toString(),
      handle: user.handle,
      name: formatUserDisplayName(user.first_name, user.last_name, user.handle),
      role: user.role,
      status: user.status,
      created_at: user.created_at.toISOString(),
    }));

    return NextResponse.json({
      data: payload,
      nextCursor,
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to list users', error);
    return NextResponse.json(
      { error: 'Unable to load users.', },
      { status: 500, }
    );
  }
}
