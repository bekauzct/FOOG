import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verify } from './auth';
import { redisSub } from './redis';
import { CHANNEL, publish, type RtEvent } from './events';
import { prisma } from './db';
import { sendMessage } from './routes/chat';

/** WebSocket server: /ws?token=<ws-token>. Chat xabarlari, bildirishnoma, bron holati real vaqtda. */
const sockets = new Map<string, Set<WebSocket>>();

function deliver(e: RtEvent) {
  const payload = JSON.stringify({ type: e.type, data: e.data });
  for (const uid of e.to) for (const ws of sockets.get(uid) ?? []) if (ws.readyState === ws.OPEN) ws.send(payload);
}

export async function startWs(server: Server) {
  await redisSub.subscribe(CHANNEL);
  redisSub.on('message', (_ch, msg) => {
    try { deliver(JSON.parse(msg) as RtEvent); } catch { /* noop */ }
  });
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', 'http://x');
    const c = verify(url.searchParams.get('token') ?? '');
    if (!c?.ws) return ws.close(4401, 'unauthorized');
    const uid = c.sub;
    const set = sockets.get(uid) ?? new Set();
    set.add(ws);
    sockets.set(uid, set);
    await prisma.user.update({ where: { id: uid }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    const alive = setInterval(() => ws.readyState === ws.OPEN && ws.ping(), 25000);
    ws.on('message', async (raw) => {
      try {
        const m = JSON.parse(String(raw)) as { type: string; chatId?: string; body?: string };
        if (!m.chatId) return;
        const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId: m.chatId, userId: uid } } });
        if (!member) return;
        if (m.type === 'typing') {
          const others = await prisma.chatMember.findMany({ where: { chatId: m.chatId, userId: { not: uid } }, select: { userId: true } });
          await publish(others.map((o) => o.userId), 'typing', { chatId: m.chatId, userId: uid });
        } else if (m.type === 'message' && m.body?.trim()) {
          await sendMessage(m.chatId, uid, { type: 'text', body: m.body.trim().slice(0, 4000) });
        }
      } catch (e) {
        console.warn('[ws]', (e as Error).message);
      }
    });
    ws.on('close', async () => {
      clearInterval(alive);
      set.delete(ws);
      if (!set.size) sockets.delete(uid);
      await prisma.user.update({ where: { id: uid }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    });
  });
  return wss;
}
