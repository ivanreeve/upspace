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

    // Validate and normalize query params
    const querySchema = z.object({
      // pagination
      limit: z.coerce.number().int().min(1).max(100).default(20),
      cursor: z.string().regex(/^\d+$/).optional(),

      // simple equals filters
      city: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
      postal_code: z.string().min(1).optional(),
      user_id: z.string().regex(/^\d+$/).optional(),

      // search
      q: z.string().min(1).optional(),

      // date ranges (RFC3339/ISO-8601)
      created_from: z.string().datetime().optional(),
      created_to: z.string().datetime().optional(),
      updated_from: z.string().datetime().optional(),
      updated_to: z.string().datetime().optional(),

      // ids filter
      space_ids: z.string().optional(), // comma-separated digits

      // relational filters
      amenities: z.string().optional(), // comma-separated list of names
      amenities_mode: z.enum(['all', 'any']).optional(),
      min_capacity: z.coerce.number().int().min(0).optional(),
      bookmark_user_id: z.string().regex(/^\d+$/).optional(),
      available_days: z.string().optional(), // comma-separated day_of_week

      // rate-based filters through areas->rates
      rate_time_unit: z.string().min(1).optional(),
      min_rate_price: z.coerce.number().nonnegative().optional(),
      max_rate_price: z.coerce.number().nonnegative().optional(),

      // sorting
      sort: z.enum(['space_id','name','created_at','updated_at']).optional(),
      order: z.enum(['asc','desc']).optional(),
    });

    const parsed = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      city: searchParams.get('city') ?? undefined,
      region: searchParams.get('region') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      postal_code: searchParams.get('postal_code') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      created_from: searchParams.get('created_from') ?? undefined,
      created_to: searchParams.get('created_to') ?? undefined,
      updated_from: searchParams.get('updated_from') ?? undefined,
      updated_to: searchParams.get('updated_to') ?? undefined,
      space_ids: searchParams.get('space_ids') ?? undefined,
      amenities: searchParams.get('amenities') ?? undefined,
      amenities_mode: searchParams.get('amenities_mode') ?? undefined,
      min_capacity: searchParams.get('min_capacity') ?? undefined,
      bookmark_user_id: searchParams.get('bookmark_user_id') ?? undefined,
      available_days: searchParams.get('available_days') ?? undefined,
      rate_time_unit: searchParams.get('rate_time_unit') ?? undefined,
      min_rate_price: searchParams.get('min_rate_price') ?? undefined,
      max_rate_price: searchParams.get('max_rate_price') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const {
      limit,
      cursor,
      city,
      region,
      country,
      postal_code,
      user_id,
      q,
      created_from,
      created_to,
      updated_from,
      updated_to,
      space_ids,
      amenities,
      amenities_mode,
      min_capacity,
      bookmark_user_id,
      available_days,
      rate_time_unit,
      min_rate_price,
      max_rate_price,
      sort,
      order,
    } = parsed.data;

    // Build Prisma where clause
    const and: any[] = [];
    if (city) and.push({ city });
    if (region) and.push({ region });
    if (country) and.push({ country });
    if (postal_code) and.push({ postal_code });
    if (user_id) and.push({ user_id: BigInt(user_id) });

    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { street: { contains: q, mode: 'insensitive' as const } },
          { address_subunit: { contains: q, mode: 'insensitive' as const } },
          { unit_number: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
          { region: { contains: q, mode: 'insensitive' as const } },
          { country: { contains: q, mode: 'insensitive' as const } },
          { postal_code: { contains: q, mode: 'insensitive' as const } },
        ],
      });
    }

    // Space IDs filter
    const ids = (space_ids ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d+$/.test(s))
      .map(s => BigInt(s));
    if (ids.length > 0) and.push({ space_id: { in: ids } });

    // Created/updated range filters
    if (created_from || created_to) {
      const created: any = {};
      if (created_from) created.gte = new Date(created_from);
      if (created_to) created.lte = new Date(created_to);
      and.push({ created_at: created });
    }
    if (updated_from || updated_to) {
      const updated: any = {};
      if (updated_from) updated.gte = new Date(updated_from);
      if (updated_to) updated.lte = new Date(updated_to);
      and.push({ updated_at: updated });
    }

    // Amenities filter: comma separated names, mode: any|all
    const amenityNames = (amenities ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (amenityNames.length > 0) {
      if ((amenities_mode ?? 'any') === 'all') {
        for (const name of amenityNames) {
          and.push({ amenity: { some: { name: { equals: name, mode: 'insensitive' as const } } } });
        }
      } else {
        and.push({
          amenity: {
            some: {
              OR: amenityNames.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })),
            },
          },
        });
      }
    }

    // Minimum capacity via related areas
    if (typeof min_capacity === 'number') {
      and.push({ area: { some: { capacity: { gte: BigInt(min_capacity) } } } });
    }

    // Bookmarked by a specific user
    if (bookmark_user_id) {
      and.push({ bookmark: { some: { user_id: BigInt(bookmark_user_id) } } });
    }

    // Availability by day_of_week
    const days = (available_days ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (days.length > 0) {
      and.push({ space_availability: { some: { day_of_week: { in: days } } } });
    }

    // Rate-based price/time-unit filter via areas -> rates
    if (rate_time_unit || typeof min_rate_price === 'number' || typeof max_rate_price === 'number') {
      const priceCond: any = {};
      if (typeof min_rate_price === 'number') priceCond.gte = min_rate_price;
      if (typeof max_rate_price === 'number') priceCond.lte = max_rate_price;
      const rateCond: any = {};
      if (rate_time_unit) rateCond.time_unit = rate_time_unit;
      if (Object.keys(priceCond).length > 0) rateCond.price = priceCond;

      and.push({ area: { some: { rate_rate_area_idToarea: { some: rateCond } } } });
    }

    const where = and.length > 0 ? { AND: and } : {};

    // Pagination and sorting
    const take = limit + 1; // read one extra to know if there's a next page
    const orderBy = (() => {
      const field = sort ?? 'space_id';
      const direction = order ?? 'asc';
      return { [field]: direction } as const;
    })();

    const rows = await prisma.space.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { space_id: BigInt(cursor), }, } : {}),
      orderBy,
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
      return NextResponse.json({ error: 'User not found.', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to create space', }, { status: 500, });
  }
}
