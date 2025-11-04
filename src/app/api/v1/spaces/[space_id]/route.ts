import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

type Params = { params: { space_id?: string } };

const isNumericId = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

// Fields allowed to update on space
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  unit_number: z.string().min(1).max(200).optional(),
  street: z.string().min(1).max(200).optional(),
  address_subunit: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(200).optional(),
  region: z.string().min(1).max(200).optional(),
  country_code: z.string().min(2).max(2).optional(),
  postal_code: z.string().min(1).max(50).optional(),
}).refine((data) => Object.values(data).some(v => v !== undefined), { message: 'At least one field must be provided', });

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const serializeSpaceDetail = (row: any) => {
  const formatBigInt = (value: bigint | null | undefined) => (typeof value === 'bigint' ? value.toString() : value ?? null);
  const formatDecimal = (value: any) => {
    if (value == null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const availability = Array.isArray(row.space_availability)
    ? row.space_availability.map((slot: any) => {
      const dayIndex = typeof slot.day_of_week === 'number'
        ? slot.day_of_week
        : Number(slot.day_of_week ?? 0);
      return {
        availability_id: formatBigInt(slot.availability_id),
        day_index: dayIndex,
        day_label: DAY_LABELS[dayIndex] ?? String(dayIndex),
        opening: slot.opening instanceof Date ? slot.opening.toISOString() : slot.opening,
        closing: slot.closing instanceof Date ? slot.closing.toISOString() : slot.closing,
      };
    })
    : [];

  const areas = Array.isArray(row.area)
    ? row.area.map((area: any) => ({
      area_id: formatBigInt(area.area_id),
      name: area.name,
      min_capacity: area.min_capacity !== null && area.min_capacity !== undefined
        ? Number(area.min_capacity)
        : null,
      max_capacity: area.max_capacity !== null && area.max_capacity !== undefined
        ? Number(area.max_capacity)
        : null,
      images: Array.isArray(area.image)
        ? area.image.map((img: any) => ({
          image_id: formatBigInt(img.image_id),
          url: img.url,
        }))
        : [],
      price_rates: Array.isArray(area.price_rate)
        ? area.price_rate.map((rate: any) => ({
          rate_id: formatBigInt(rate.rate_id),
          time_unit: rate.time_unit,
          price: formatDecimal(rate.price),
        }))
        : [],
    }))
    : [];

  const amenities = Array.isArray(row.amenity)
    ? row.amenity.map((item: any) => ({
      amenity_id: formatBigInt(item.amenity_id),
      name: item.name,
    }))
    : [];

  const galleryImages = Array.isArray(row.other_image)
    ? row.other_image.map((img: any) => img.url)
    : [];

  const host = row.user
    ? {
      user_id: formatBigInt(row.user.user_id),
      first_name: row.user.first_name ?? null,
      last_name: row.user.last_name ?? null,
      full_name: [row.user.first_name, row.user.last_name].filter(Boolean).join(' ') || null,
    }
    : null;

  return {
    space_id: formatBigInt(row.space_id),
    user_id: formatBigInt(row.user_id),
    name: row.name,
    overview: row.description ?? null,
    unit_number: row.unit_number,
    street: row.street,
    address_subunit: row.address_subunit,
    city: row.city,
    region: row.region,
    country_code: row.country_code,
    postal_code: row.postal_code,
    lat: formatDecimal(row.lat),
    long: formatDecimal(row.long),
    images: galleryImages,
    amenities,
    areas,
    availability,
    host,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

export async function GET(_req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be numeric', }, { status: 400, });
  }

  const id = BigInt(space_id);

  const row = await prisma.space.findUnique({
    where: { space_id: id, },
    select: {
      space_id: true,
      user_id: true,
      name: true,
      unit_number: true,
      street: true,
      address_subunit: true,
      city: true,
      region: true,
      country_code: true,
      postal_code: true,
      description: true,
      lat: true,
      long: true,
      created_at: true,
      updated_at: true,
      amenity: {
        select: {
          amenity_id: true,
          name: true,
        },
      },
      area: {
        select: {
          area_id: true,
          name: true,
          min_capacity: true,
          max_capacity: true,
          image: {
            select: {
              image_id: true,
              url: true,
            },
            orderBy: [
              { is_primary: 'desc', },
              { display_order: 'asc', },
              { created_at: 'asc', }
            ],
          },
          price_rate: {
            select: {
              rate_id: true,
              time_unit: true,
              price: true,
            },
            orderBy: [
              { created_at: 'asc', }
            ],
          },
        },
      },
      space_availability: {
        select: {
          availability_id: true,
          day_of_week: true,
          opening: true,
          closing: true,
        },
      },
      other_image: {
        select: {
          image_id: true,
          url: true,
          is_primary: true,
          display_order: true,
          created_at: true,
        },
        orderBy: [
          { is_primary: 'desc', },
          { display_order: 'asc', },
          { created_at: 'asc', }
        ],
      },
      user: {
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: 'Space not found', }, { status: 404, });
  }

  return NextResponse.json({ data: serializeSpaceDetail(row), }, { status: 200, });
}


export async function PUT(req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be numeric', }, { status: 400, });
  }

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
  }

  const id = BigInt(space_id);

  try {
    const updated = await prisma.space.update({
      where: { space_id: id, },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name, } : {}),
        ...(parsed.data.unit_number !== undefined ? { unit_number: parsed.data.unit_number, } : {}),
        ...(parsed.data.street !== undefined ? { street: parsed.data.street, } : {}),
        ...(parsed.data.address_subunit !== undefined ? { address_subunit: parsed.data.address_subunit, } : {}),
        ...(parsed.data.city !== undefined ? { city: parsed.data.city, } : {}),
        ...(parsed.data.region !== undefined ? { region: parsed.data.region, } : {}),
        ...(parsed.data.country_code !== undefined ? { country_code: parsed.data.country_code, } : {}),
        ...(parsed.data.postal_code !== undefined ? { postal_code: parsed.data.postal_code, } : {}),
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
        country_code: true,
        postal_code: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      data: {
        space_id: updated.space_id.toString(),
        user_id: updated.user_id.toString(),
        name: updated.name,
        unit_number: updated.unit_number,
        street: updated.street,
        address_subunit: updated.address_subunit,
        city: updated.city,
        region: updated.region,
        country_code: updated.country_code,
        postal_code: updated.postal_code,
        created_at: updated.created_at instanceof Date ? updated.created_at.toISOString() : updated.created_at,
        updated_at: updated.updated_at instanceof Date ? updated.updated_at.toISOString() : updated.updated_at,
      },
    }, { status: 200, });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Space not found', }, { status: 404, });
    }
    return NextResponse.json({ error: 'Failed to update space', }, { status: 500, });
  }
}

export async function DELETE(_req: NextRequest, { params, }: Params) {
  const { space_id, } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be numeric', }, { status: 400, });
  }

  const id = BigInt(space_id);

  try {
    await prisma.space.delete({ where: { space_id: id, }, });
    return NextResponse.json({
      message: 'Space deleted successfully',
      data: {
 space_id: id.toString(),
deleted: true, 
},
    }, { status: 200, });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Space not found', }, { status: 404, });
    }
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Cannot delete space with related records', }, { status: 409, });
    }
    return NextResponse.json({ error: 'Failed to delete space', }, { status: 500, });
  }
}
