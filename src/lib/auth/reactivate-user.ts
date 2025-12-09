import { user_status } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type ReactivationOutcome =
  | { allow: true; status: user_status; updated: boolean }
  | { allow: false; status: user_status | null; updated: boolean; reason: string };

/**
 * Resolves user status on login/profile sync:
 * - Cancels pending deletion if within window.
 * - Blocks login if deletion window expired or account is deleted.
 * - Auto-reactivates deactivated users.
 */
export async function reactivateUserIfEligible(authUserId: string): Promise<ReactivationOutcome> {
  const user = await prisma.user.findUnique({
    where: { auth_user_id: authUserId, },
    select: {
      status: true,
      role: true,
      pending_deletion_at: true,
      expires_at: true,
    },
  });

  if (!user) {
    return {
 allow: false,
status: null,
updated: false,
reason: 'not_found', 
};
  }

  const now = new Date();

  if (user.status === user_status.deleted) {
    return {
 allow: false,
status: user.status,
updated: false,
reason: 'deleted', 
};
  }

  if (user.status === user_status.pending_deletion) {
    const expiresAt = user.expires_at ? new Date(user.expires_at) : null;
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      await prisma.user.update({
        where: { auth_user_id: authUserId, },
        data: {
 status: user_status.deleted,
deleted_at: now, 
},
      });
      return {
 allow: false,
status: user_status.deleted,
updated: true,
reason: 'deletion_expired', 
};
    }

    await prisma.user.update({
      where: { auth_user_id: authUserId, },
      data: {
        status: user_status.active,
        pending_deletion_at: null,
        expires_at: null,
        deleted_at: null,
        cancelled_at: now,
      },
    });
    return {
 allow: true,
status: user_status.active,
updated: true, 
};
  }

  if (user.status === user_status.deactivated) {
    await prisma.user.update({
      where: { auth_user_id: authUserId, },
      data: { status: user_status.active, },
    });
    return {
      allow: true,
      status: user_status.active,
      updated: true,
    };
  }

  return {
 allow: true,
status: user.status,
updated: false, 
};
}
