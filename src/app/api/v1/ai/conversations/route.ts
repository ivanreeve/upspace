import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_CONVERSATIONS = 50;

const createPayloadSchema = z.object({ title: z.string().trim().max(200).optional(), });

async function resolveAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return null;
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { user_id: true, },
  });

  return dbUser;
}

const unauthorizedResponse = () =>
  NextResponse.json({ error: 'Authentication required.', }, { status: 401, });

const userNotFoundResponse = () =>
  NextResponse.json({ error: 'User profile not found.', }, { status: 403, });

export async function GET() {
  const dbUser = await resolveAuthenticatedUser();
  if (!dbUser) {
    return unauthorizedResponse();
  }

  const conversations = await prisma.ai_conversation.findMany({
    where: {
      user_id: dbUser.user_id,
      deleted_at: null,
    },
    orderBy: { updated_at: 'desc', },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      title: true,
      created_at: true,
      updated_at: true,
    },
  });

  return NextResponse.json({ conversations, }, { status: 200, });
}

export async function POST(req: NextRequest) {
  const dbUser = await resolveAuthenticatedUser();
  if (!dbUser) {
    return unauthorizedResponse();
  }

  const body = await req.json().catch(() => null);
  const parsed = createPayloadSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.', }, { status: 400, });
  }

  const conversation = await prisma.ai_conversation.create({
    data: {
      user_id: dbUser.user_id,
      title: parsed.data.title ?? null,
    },
    select: {
      id: true,
      title: true,
      created_at: true,
      updated_at: true,
    },
  });

  return NextResponse.json({ conversation, }, { status: 201, });
}
