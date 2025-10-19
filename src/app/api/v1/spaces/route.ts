import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

// JSON-safe replacer: BigInt->string, Date->ISO
const replacer = (_k: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString()
  : v instanceof Date ? v.toISOString()
  : v;

export async function GET(req: NextRequest) {
  try {
    const { searchParams, } = new URL(req.url);

    // Pagination (cursor = last space_id as string)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const cursor = searchParams.get('cursor');

    // Simple filters (extend as needed)
    const city   = searchParams.get('city')   ?? undefined;
    const region = searchParams.get('region') ?? undefined;
    const q      = searchParams.get('q')      ?? undefined; // name contains

    const where = {
      ...(city ? { city, } : {}),
      ...(region ? { region, } : {}),
      ...(q ? {
        name: {
          contains: q,
          mode: 'insensitive' as const,
        },
      } : {}),
    };

    const take = limit + 1; // read one extra to know if there's a next page
    const rows = await prisma.space.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { space_id: BigInt(cursor), }, } : {}),
      orderBy: { space_id: 'asc', }, // use a unique, stable field
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? String(items[items.length - 1].space_id as unknown as bigint) : null;

    const body = JSON.stringify({
      data: items,
      nextCursor,
    }, replacer);

    return new NextResponse(body, {
      headers: { 'content-type': 'application/json', },
      status: 200, // per catalog
    });
  } catch (err) {
    // Typical errors in the catalog include 401/403/429; those are usually enforced by middleware.
    return NextResponse.json({ error: 'Failed to list spaces', }, { status: 500, });
  }
}

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({ test: 'Post space', }, { status: 200, });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create space', }, { status: 500, });
  }
}
