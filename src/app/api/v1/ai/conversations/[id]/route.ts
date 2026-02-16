import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idParamSchema = z.object({ id: z.string().uuid(), });
const renamePayloadSchema = z.object({ title: z.string().trim().min(1).max(200), });

async function resolveAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return null;
  }

  return prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { user_id: true, },
  });
}

const unauthorizedResponse = () =>
  NextResponse.json({ error: 'Authentication required.', }, { status: 401, });

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const dbUser = await resolveAuthenticatedUser();
  if (!dbUser) {
    return unauthorizedResponse();
  }

  const { id, } = idParamSchema.parse(await context.params);

  const conversation = await prisma.ai_conversation.findFirst({
    where: {
      id,
      user_id: dbUser.user_id,
      deleted_at: null,
    },
    select: {
      id: true,
      title: true,
      created_at: true,
      updated_at: true,
      messages: {
        orderBy: { created_at: 'asc', },
        select: {
          id: true,
          conversation_id: true,
          role: true,
          content: true,
          space_results: true,
          booking_action: true,
          created_at: true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.', }, { status: 404, });
  }

  return NextResponse.json({ conversation, }, { status: 200, });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const dbUser = await resolveAuthenticatedUser();
  if (!dbUser) {
    return unauthorizedResponse();
  }

  const { id, } = idParamSchema.parse(await context.params);

  const body = await req.json().catch(() => null);
  const parsed = renamePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid title.', }, { status: 400, });
  }

  const existing = await prisma.ai_conversation.findFirst({
    where: {
 id,
user_id: dbUser.user_id,
deleted_at: null, 
},
    select: { id: true, },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Conversation not found.', }, { status: 404, });
  }

  const conversation = await prisma.ai_conversation.update({
    where: { id, },
    data: { title: parsed.data.title, },
    select: {
      id: true,
      title: true,
      created_at: true,
      updated_at: true,
    },
  });

  return NextResponse.json({ conversation, }, { status: 200, });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const dbUser = await resolveAuthenticatedUser();
  if (!dbUser) {
    return unauthorizedResponse();
  }

  const { id, } = idParamSchema.parse(await context.params);

  const existing = await prisma.ai_conversation.findFirst({
    where: {
 id,
user_id: dbUser.user_id,
deleted_at: null, 
},
    select: { id: true, },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Conversation not found.', }, { status: 404, });
  }

  await prisma.ai_conversation.update({
    where: { id, },
    data: { deleted_at: new Date(), },
  });

  return NextResponse.json({ message: 'Conversation deleted.', }, { status: 200, });
}
