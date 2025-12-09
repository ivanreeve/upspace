import { getRedisClient } from '@/lib/cache/redis';

const TESTING_MODE_KEY = 'feature:testing_mode';

export async function getTestingMode(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  const value = await client.get(TESTING_MODE_KEY);
  return value === 'true';
}

export async function setTestingMode(enabled: boolean): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client unavailable');
  }

  await client.set(TESTING_MODE_KEY, enabled ? 'true' : 'false');
}
