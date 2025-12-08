import { createHash } from 'node:crypto';

import { createClient, type RedisClientType } from 'redis';

const SPACES_LIST_CACHE_PREFIX = 'spaces:list:';
const DEFAULT_SPACES_LIST_TTL_SECONDS = 60;

let redisClient: RedisClientType | null = null;
let connectPromise: Promise<void> | null = null;

function parseTtlEnvValue(): number {
  const rawValue = process.env.SPACES_LIST_CACHE_TTL_SECONDS;
  if (!rawValue) {
    return DEFAULT_SPACES_LIST_TTL_SECONDS;
  }
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return DEFAULT_SPACES_LIST_TTL_SECONDS;
  }
  return Math.floor(numericValue);
}

export const SPACES_LIST_CACHE_TTL_SECONDS = parseTtlEnvValue();

async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createClient({ url, });
    redisClient.on('error', (error) => {
      console.error('Redis error', error);
    });
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      await redisClient?.connect();
    })().catch((error) => {
      console.error('Failed to connect to Redis', error);
      redisClient = null;
      connectPromise = null;
      throw error;
    });
  }

  try {
    await connectPromise;
  } catch {
    return null;
  } finally {
    connectPromise = null;
  }

  return redisClient;
}

async function withRedisClient<T>(operation: (client: RedisClientType) => Promise<T>) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }
    return await operation(client);
  } catch (error) {
    console.error('Redis command failed', error);
    return null;
  }
}

export function buildSpacesListCacheKey(signature: Record<string, unknown>) {
  const signaturePayload = JSON.stringify(signature);
  const hash = createHash('sha256')
    .update(signaturePayload)
    .digest('hex');
  return `${SPACES_LIST_CACHE_PREFIX}${hash}`;
}

export async function readSpacesListCache(key: string): Promise<string | null> {
  if (SPACES_LIST_CACHE_TTL_SECONDS <= 0) {
    return null;
  }
  if (!key.startsWith(SPACES_LIST_CACHE_PREFIX)) {
    return null;
  }
  return withRedisClient((client) => client.get(key));
}

export async function setSpacesListCache(
  key: string,
  value: string,
  signature: Record<string, unknown>,
  nextCursor: string | null
): Promise<void> {
  if (SPACES_LIST_CACHE_TTL_SECONDS <= 0) {
    return;
  }
  if (!key.startsWith(SPACES_LIST_CACHE_PREFIX)) {
    return;
  }
  await withRedisClient((client) =>
    client
      .multi()
      .hSet(key, {
        payload: value,
        filters: JSON.stringify(signature),
        next_cursor: nextCursor ?? '',
        created_at: new Date().toISOString(),
      })
      .expire(key, SPACES_LIST_CACHE_TTL_SECONDS)
      .exec()
  );
}

async function deleteKeysByPattern(pattern: string) {
  await withRedisClient(async (client) => {
    const buffer: string[] = [];
    for await (const key of client.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      buffer.push(key);
      if (buffer.length >= 100) {
        await client.del(...buffer);
        buffer.length = 0;
      }
    }
    if (buffer.length) {
      await client.del(...buffer);
    }
  });
}

export async function invalidateSpacesListCache() {
  if (SPACES_LIST_CACHE_TTL_SECONDS <= 0) {
    return;
  }
  await deleteKeysByPattern(`${SPACES_LIST_CACHE_PREFIX}*`);
}
