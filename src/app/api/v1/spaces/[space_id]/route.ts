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
  country: z.string().min(1).max(200).optional(),
  postal_code: z.string().min(1).max(50).optional(),
}).refine((data) => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});

export async function GET(_req: NextRequest, { params }: Params) {
  const { space_id } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be numeric' }, { status: 400 });
  }

  const id = BigInt(space_id);

  const row = await prisma.space.findUnique({
    where: { space_id: id },
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

  if (!row) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      space_id: row.space_id.toString(),
      user_id: row.user_id.toString(),
      name: row.name,
      unit_number: row.unit_number,
      street: row.street,
      address_subunit: row.address_subunit,
      city: row.city,
      region: row.region,
      country: row.country,
      postal_code: row.postal_code,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    },
  });
}


export async function PUT(req: NextRequest, { params }: Params) {
  const { space_id } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be numeric' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = BigInt(space_id);

  try {
    const updated = await prisma.space.update({
      where: { space_id: id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.unit_number !== undefined ? { unit_number: parsed.data.unit_number } : {}),
        ...(parsed.data.street !== undefined ? { street: parsed.data.street } : {}),
        ...(parsed.data.address_subunit !== undefined ? { address_subunit: parsed.data.address_subunit } : {}),
        ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
        ...(parsed.data.region !== undefined ? { region: parsed.data.region } : {}),
        ...(parsed.data.country !== undefined ? { country: parsed.data.country } : {}),
        ...(parsed.data.postal_code !== undefined ? { postal_code: parsed.data.postal_code } : {}),
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
        country: updated.country,
        postal_code: updated.postal_code,
        created_at: updated.created_at instanceof Date ? updated.created_at.toISOString() : updated.created_at,
        updated_at: updated.updated_at instanceof Date ? updated.updated_at.toISOString() : updated.updated_at,
      },
    }, { status: 200 });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update space' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { space_id } = params;
  if (!isNumericId(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be numeric' }, { status: 400 });
  }

  const id = BigInt(space_id);

  try {
    await prisma.space.delete({ where: { space_id: id } });
    return NextResponse.json({
      message: 'Space deleted successfully',
      data: { space_id: id.toString(), deleted: true },
    }, { status: 200 });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'Cannot delete space with related records' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to delete space' }, { status: 500 });
  }
}