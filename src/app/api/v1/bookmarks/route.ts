import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const payloadSchema = z.object({ space_id: z.string().uuid(), });

const convertSpaceIdToBigInt = (value: string): bigint => {
  const normalized = value.replace(/-/g, '');
  const as128Bit = BigInt(`0x${normalized}`);
  // Clamp to the positive signed BIGINT range so Postgres can store it.
  return BigInt.asUintN(63, as128Bit);
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: 'Authentication required.', },
      { status: 401, }
    );
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { user_id: true, },
  });

  if (!dbUser) {
    return NextResponse.json(
      { error: 'User profile not found.', },
      { status: 403, }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid space ID.', },
      { status: 400, }
    );
  }

  const space = await prisma.space.findUnique({
    where: { id: parsed.data.space_id, },
    select: { id: true, },
  });

  if (!space) {
    return NextResponse.json(
      { error: 'Space not found.', },
      { status: 404, }
    );
  }

  const bookmarkSpaceId = convertSpaceIdToBigInt(parsed.data.space_id);
  const alreadyBookmarked = await prisma.bookmark.findFirst({
    where: {
      user_id: dbUser.user_id,
      space_id: bookmarkSpaceId,
    },
  });

  if (alreadyBookmarked) {
    return NextResponse.json(
      { message: 'Already bookmarked.', },
      { status: 200, }
    );
  }

  await prisma.bookmark.create({
    data: {
      user_id: dbUser.user_id,
      space_id: bookmarkSpaceId,
      created_at: new Date(),
    },
  });

  return NextResponse.json(
    { message: 'Bookmark saved.', },
    { status: 201, }
  );
}
