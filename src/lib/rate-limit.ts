import { createHash } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { getRedisClient } from '@/lib/cache/redis';

type RateLimitConfig = {
  limit: number;
  windowSeconds: number;
};

const DEFAULT_RATE_LIMIT_CONFIGS = {
  'spaces-list': createRateLimitConfig('RATE_LIMIT_SPACES_LIMIT', 'RATE_LIMIT_SPACES_WINDOW', 120, 60),
  'spaces-suggest': createRateLimitConfig('RATE_LIMIT_SPACES_SUGGEST_LIMIT', 'RATE_LIMIT_SPACES_SUGGEST_WINDOW', 60, 60),
  'partner-spaces': createRateLimitConfig('RATE_LIMIT_PARTNER_SPACES_LIMIT', 'RATE_LIMIT_PARTNER_SPACES_WINDOW', 30, 60),
  'partner-dashboard-feed': createRateLimitConfig(
    'RATE_LIMIT_PARTNER_DASHBOARD_FEED_LIMIT',
    'RATE_LIMIT_PARTNER_DASHBOARD_FEED_WINDOW',
    30,
    60
  ),
} as const;

export type RateLimitScope = keyof typeof DEFAULT_RATE_LIMIT_CONFIGS;

function createRateLimitConfig(
  limitEnv: string,
  windowEnv: string,
  defaultLimit: number,
  defaultWindow: number
): RateLimitConfig {
  return {
    limit: parseRateLimitEnvValue(limitEnv, defaultLimit),
    windowSeconds: parseRateLimitEnvValue(windowEnv, defaultWindow),
  };
}

function parseRateLimitEnvValue(envVar: string, fallback: number): number {
  const rawValue = process.env[envVar];
  if (!rawValue) {
    return fallback;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return Math.floor(numericValue);
}

function buildRateLimitKey(scope: RateLimitScope, identifier: string) {
  const fingerprint = identifier.trim() || 'anonymous';
  const hash = createHash('sha256').update(fingerprint).digest('hex');
  return `rate:${scope}:${hash}`;
}

function resolveRequestIdentifier(request?: NextRequest) {
  if (!request) {
    return 'anonymous';
  }

  const normalizeHeader = (value: string | null) =>
    value?.split(',')[0]?.trim() ?? null;

  const candidate =
    normalizeHeader(request.headers.get('x-forwarded-for')) ??
    normalizeHeader(request.headers.get('cf-connecting-ip')) ??
    normalizeHeader(request.headers.get('fastly-client-ip')) ??
    normalizeHeader(request.headers.get('x-real-ip')) ??
    (request as NextRequest & { ip?: string }).ip ??
    request.nextUrl.host ??
    'anonymous';

  const userAgent = request.headers.get('user-agent');
  return userAgent ? `${candidate}|${userAgent}` : candidate;
}

class RateLimitCounterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitCounterError';
  }
}

async function incrementRateLimitCounter(key: string, windowSeconds: number) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const nextValue = await client.incr(key);
    if (nextValue === 1) {
      await client.expire(key, windowSeconds);
    }

    return nextValue;
  } catch (error) {
    console.error('Failed to record rate limit counter', error);
    throw new RateLimitCounterError('Unable to check rate limit');
  }
}

export class RateLimitExceededError extends Error {
  public readonly scope: RateLimitScope;
  public readonly retryAfter: number;

  constructor(scope: RateLimitScope, retryAfter: number) {
    super('Too many requests. Please try again later.');
    this.scope = scope;
    this.retryAfter = retryAfter;
    this.name = 'RateLimitExceededError';
  }
}

export async function enforceRateLimit({
  scope,
  request,
  identity,
}: {
  scope: RateLimitScope;
  request?: NextRequest;
  identity?: string;
}): Promise<void> {
  const config = DEFAULT_RATE_LIMIT_CONFIGS[scope];
  if (!config || config.limit <= 0 || config.windowSeconds <= 0) {
    return;
  }

  const identifier = identity
    ? identity.trim() || 'anonymous'
    : resolveRequestIdentifier(request);
  const key = buildRateLimitKey(scope, identifier);

  try {
    const counter = await incrementRateLimitCounter(key, config.windowSeconds);
    if (counter === null) {
      return;
    }

    if (counter > config.limit) {
      throw new RateLimitExceededError(scope, config.windowSeconds);
    }
  } catch (error) {
    if (error instanceof RateLimitCounterError) {
      // If the counter cannot be incremented, we do not block the request.
      return;
    }
    throw error;
  }
}
