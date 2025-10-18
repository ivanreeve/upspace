import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
      ...(city   ? { city, } : {}),
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
  const bodySchema = z.object({
    user_id: z.string().regex(/^\d+$/),
    name: z.string().min(1).max(200),
    unit_number: z.string().min(1).max(200),
    street: z.string().min(1).max(200),
    address_subunit: z.string().min(1).max(200),
    city: z.string().min(1).max(200),
    region: z.string().min(1).max(200),
    country: z.string().min(1).max(200),
    postal_code: z.string().min(1).max(50),
  });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  try {
    const now = new Date();
    const created = await prisma.space.create({
      data: {
        user_id: BigInt(parsed.data.user_id),
        name: parsed.data.name,
        unit_number: parsed.data.unit_number,
        street: parsed.data.street,
        address_subunit: parsed.data.address_subunit,
        city: parsed.data.city,
        region: parsed.data.region,
        country: parsed.data.country,
        postal_code: parsed.data.postal_code,
        created_at: now,
        updated_at: now,
      },
      select: {
        space_id: true,
        user_id: true,
        name: true,
        unit_number: true,
        street: true,
        address_subunit: true,
        city: true,
        region: true,
        country: true,
        postal_code: true,
        created_at: true,
        updated_at: true,
      },
    });

    const payload = {
      space_id: created.space_id.toString(),
      user_id: created.user_id.toString(),
      name: created.name,
      unit_number: created.unit_number,
      street: created.street,
      address_subunit: created.address_subunit,
      city: created.city,
      region: created.region,
      country: created.country,
      postal_code: created.postal_code,
      created_at: created.created_at instanceof Date ? created.created_at.toISOString() : created.created_at,
      updated_at: created.updated_at instanceof Date ? created.updated_at.toISOString() : created.updated_at,
    };

    const res = NextResponse.json({ data: payload, }, { status: 201, });
    res.headers.set('Location', `/api/v1/spaces/${payload.space_id}`);
    return res;
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to create space', }, { status: 500, });
  }
}