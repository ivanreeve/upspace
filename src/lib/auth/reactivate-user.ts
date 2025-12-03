import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const ACCOUNT_DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const DEACTIVATION_METADATA_KEY = 'deactivation_requested_at';
const DELETION_METADATA_KEY = 'deletion_requested_at';

type ReactivationMetadata = {
  key: typeof DEACTIVATION_METADATA_KEY | typeof DELETION_METADATA_KEY;
  requestedAt: Date;
  type: 'deactivation' | 'deletion';
};

function parseReactivationMetadata(metadata: Prisma.JsonValue | null): ReactivationMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const candidate = metadata as Record<string, unknown>;
  const deactivationAt = candidate[DEACTIVATION_METADATA_KEY];
  if (typeof deactivationAt === 'string') {
    const parsed = new Date(deactivationAt);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        key: DEACTIVATION_METADATA_KEY,
        requestedAt: parsed,
        type: 'deactivation',
      };
    }
  }

  const deletionAt = candidate[DELETION_METADATA_KEY];
  if (typeof deletionAt === 'string') {
    const parsed = new Date(deletionAt);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        key: DELETION_METADATA_KEY,
        requestedAt: parsed,
        type: 'deletion',
      };
    }
  }

  return null;
}

export async function reactivateUserIfEligible(userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<
    Array<{ user_metadata: Prisma.JsonValue | null }>
  >`
    SELECT raw_user_meta_data AS user_metadata
    FROM auth.users
    WHERE id = ${userId}::uuid
    LIMIT 1
  `;

  const metadata = rows[0]?.user_metadata ?? null;
  const reactivation = parseReactivationMetadata(metadata);
  if (!reactivation) {
    return false;
  }

  if (reactivation.type === 'deletion') {
    const deadline = reactivation.requestedAt.getTime() + ACCOUNT_DELETION_GRACE_MS;
    if (deadline <= Date.now()) {
      return false;
    }
  }

  await prisma.user.update({
    where: { auth_user_id: userId, },
    data: { is_disabled: false, },
  });

  await prisma.$executeRaw`
    UPDATE auth.users
    SET raw_user_meta_data = (COALESCE(raw_user_meta_data, '{}'::jsonb) - ${reactivation.key})
    WHERE id = ${userId}::uuid
  `;

  return true;
}
