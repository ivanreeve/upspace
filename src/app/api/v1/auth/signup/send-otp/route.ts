import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requestSignupOtp } from '@/lib/signup-otp';

const bodySchema = z.object({ email: z.string().email(), });

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Invalid email payload.',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400, }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const existingUser = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM auth.users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;

    if (existingUser.length > 0) {
      return NextResponse.json({ message: 'User already exists', }, { status: 409, });
    }

    await requestSignupOtp(email);

    return NextResponse.json({ ok: true, });
  } catch (error) {
    console.error('Failed to send signup OTP', error);
    return NextResponse.json(
      { message: 'Unable to send verification code right now.', },
      { status: 500, }
    );
  }
}
