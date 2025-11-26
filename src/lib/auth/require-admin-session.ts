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

export async function requireAdminSession(): Promise<AdminSession> {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    throw new AdminSessionError(401, 'Authentication required.');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
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
    authUserId: authData.user.id,
    userId: dbUser.user_id,
  };
}
