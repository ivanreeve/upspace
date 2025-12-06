import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export class AdminSessionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AdminSessionError';
  }
}

export type AdminSession = {
  authUserId: string;
  userId: bigint;
};

export async function requireAdminSession(req: NextRequest): Promise<AdminSession> {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  let authUser = authData?.user ?? null;
  let authErrorToCheck = authError;

  if (!authUser) {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    if (token) {
      const tokenResult = await supabase.auth.getUser(token);
      authUser = tokenResult.data?.user ?? null;
      authErrorToCheck = tokenResult.error ?? null;
    }
  }

  if (authErrorToCheck || !authUser) {
    throw new AdminSessionError(401, 'Authentication required.');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authUser.id, },
    select: {
      user_id: true,
      role: true,
    },
  });

  if (!dbUser) {
    throw new AdminSessionError(403, 'User profile not found.');
  }

  if (dbUser.role !== 'admin') {
    throw new AdminSessionError(403, 'Admin access required.');
  }

  return {
    authUserId: authUser.id,
    userId: dbUser.user_id,
  };
}
