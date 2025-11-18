import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export class PartnerSessionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'PartnerSessionError';
  }
}

export type PartnerSession = {
  authUserId: string;
  userId: bigint;
};

export async function requirePartnerSession(): Promise<PartnerSession> {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    throw new PartnerSessionError(401, 'Authentication required.');
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      role: true,
      is_onboard: true,
    },
  });

  if (!dbUser) {
    throw new PartnerSessionError(403, 'User profile not found.');
  }

  if (dbUser.role !== 'partner') {
    throw new PartnerSessionError(403, 'Only partner accounts can manage spaces.');
  }

  if (!dbUser.is_onboard) {
    throw new PartnerSessionError(409, 'Complete onboarding before managing spaces.');
  }

  return {
    authUserId: authData.user.id,
    userId: dbUser.user_id,
  };
}
