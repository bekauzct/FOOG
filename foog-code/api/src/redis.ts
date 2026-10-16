import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });
// Pub/sub uchun alohida ulanish (bir nechta API nusxasi bo‘lsa ham real vaqt ishlaydi)
export const redisSub = new Redis(env.redisUrl);

/** Redis qulfi: SET NX PX. Qulf olinmasa – null. */
export async function acquireLocks(keys: string[], ttlMs = 15000): Promise<string | null> {
  const token = Math.random().toString(36).slice(2);
  const got: string[] = [];
  for (const k of keys) {
    const ok = await redis.set(k, token, 'PX', ttlMs, 'NX');
    if (ok !== 'OK') {
      await releaseLocks(got, token);
      return null;
    }
    got.push(k);
  }
  return token;
}

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
export async function releaseLocks(keys: string[], token: string) {
  for (const k of keys) await redis.eval(RELEASE, 1, k, token);
}
