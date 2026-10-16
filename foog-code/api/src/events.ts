import { redis } from './redis';

export const CHANNEL = 'foog:events';
export type RtEvent = { to: string[]; type: string; data: unknown };

/** Real vaqt hodisasi: Redis pub/sub orqali barcha API nusxalaridagi WebSocketlarga boradi */
export async function publish(to: string | string[], type: string, data: unknown) {
  const list = Array.isArray(to) ? to : [to];
  if (!list.length) return;
  await redis.publish(CHANNEL, JSON.stringify({ to: list, type, data } satisfies RtEvent));
}
