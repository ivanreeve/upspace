import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

// JSON-safe replacer for BigInt/Date
const replacer = (_k: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString()
  : v instanceof Date ? v.toISOString()
  : v;

const bodySchema = z.object({
  email: z.string().email('Provide a valid email.'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters.')
    .regex(/[A-Z]/, 'Include at least one uppercase letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
  first_name: z.string().min(1).default(''),
  last_name: z.string().optional(),
  handle: z.string().min(1).default('user'),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const {
      email,
      password,
      first_name,
      last_name,
      handle,
    } = parsed.data;

    // Ensure email is unique
    const existing = await prisma.user.findUnique({
      where: { email, },
      select: { user_id: true, },
    });
    if (existing) {
      return NextResponse.json({ message: 'Email already registered.', }, { status: 409, });
    }

    // Hash password for storage in credentials account provider
    const passwordHash = await hashPassword(password);

    // Minimal user creation to match schema
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          first_name: first_name || email.split('@')[0],
          last_name: last_name ?? null,
          handle,
        },
      });

      await tx.account.create({
        data: {
          user_id: user.user_id,
          provider: 'other',
          provider_id: passwordHash, // store password hash; in real apps use dedicated table
        },
      });

      return user;
    });

    return new NextResponse(JSON.stringify({
      ok: true,
      user: created,
    }, replacer), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        Location: `/api/v1/users/${created.user_id}`,
      },
    });
  } catch (error) {
    console.error('Error creating user', error);
    return NextResponse.json({ message: 'Unable to create user.', }, { status: 500, });
  }
}
