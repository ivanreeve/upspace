import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';

type EnsureUserProfileOptions = {
  authUserId: string;
  preferredHandle?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  strictHandle?: boolean;
};

export class HandleUnavailableError extends Error {
  constructor(message = 'Handle already taken.') {
    super(message);
    this.name = 'HandleUnavailableError';
  }
}

export async function ensureUserProfile({
  authUserId,
  preferredHandle,
  avatarUrl,
  email,
  metadata,
  strictHandle = false,
}: EnsureUserProfileOptions) {
  const existing = await prisma.user.findFirst({
    where: { auth_user_id: authUserId },
  });

  if (existing) {
    return existing;
  }

  const sanitizedPreferred = sanitizeHandle(preferredHandle);

  if (strictHandle) {
    if (!sanitizedPreferred) {
      throw new HandleUnavailableError('Handle is required.');
    }

    return prisma.user.create({
      data: {
        auth_user_id: authUserId,
        handle: sanitizedPreferred,
        avatar: avatarUrl ?? deriveAvatar(metadata),
      },
    });
  }

  const handle = await resolveHandle({
    preferred: sanitizedPreferred,
    email,
    metadata,
  });

  return prisma.user.create({
    data: {
      auth_user_id: authUserId,
      handle,
      avatar: avatarUrl ?? deriveAvatar(metadata),
    },
  });
}

function sanitizeHandle(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const sanitized = trimmed.replace(/[^a-z0-9._-]/g, '');
  return sanitized || null;
}

async function resolveHandle({
  preferred,
  email,
  metadata,
}: {
  preferred?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<string> {
  const candidates = new Set<string>();

  if (preferred) {
    candidates.add(preferred);
  }

  const meta = metadata ?? {};
  const metaString = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    return null;
  };

  const metadataHandle = sanitizeHandle(metaString('preferred_username', 'user_name', 'nickname'));

  if (metadataHandle) {
    candidates.add(metadataHandle);
  }

  const nameHandle = sanitizeHandle(metaString('name', 'full_name', 'given_name'));

  if (nameHandle) {
    candidates.add(nameHandle);
  }

  const emailHandle = sanitizeHandle(email ? email.split('@')[0] : null);
  if (emailHandle) {
    candidates.add(emailHandle);
  }

  if (!candidates.size) {
    candidates.add(`user-${authSuffix()}`);
  }

  for (const candidate of candidates) {
    const available = await isHandleAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  let attempts = 0;
  while (attempts < 20) {
    attempts += 1;
    const generated = `${Array.from(candidates)[0] ?? 'user'}-${authSuffix()}`;
    if (await isHandleAvailable(generated)) {
      return generated;
    }
  }

  const fallback = `user-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  return fallback;
}

async function isHandleAvailable(handle: string) {
  const existing = await prisma.user.findFirst({
    where: { handle },
    select: { user_id: true },
  });

  return !existing;
}

function deriveAvatar(metadata?: Record<string, unknown> | null) {
  const meta = metadata ?? {};
  const candidate = ['avatar_url', 'picture', 'avatar']
    .map((key) => {
      const value = meta[key];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    })
    .find((value): value is string => Boolean(value));

  return candidate ?? null;
}

function authSuffix() {
  return randomUUID().replace(/-/g, '').slice(0, 6);
}
