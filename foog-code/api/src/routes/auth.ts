import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { redis } from '../redis';
import { env } from '../env';
import { ah, bad, HttpError, parse } from '../http';
import { COOKIE, requireAuth, setAuthCookie, signToken, signWsToken } from '../auth';
import { publicUser } from '../serialize';

export const authRouter = Router();
const LOGIN_TTL = 180; // 3 daqiqa

type LoginState =
  | { status: 'pending' }
  | { status: 'shared'; phone: string; telegramId: string; firstName?: string; username?: string };

const key = (t: string) => `login:${t}`;
export async function getLogin(token: string): Promise<LoginState | null> {
  const v = await redis.get(key(token));
  return v ? (JSON.parse(v) as LoginState) : null;
}
export async function setLogin(token: string, s: LoginState) {
  const ttl = await redis.ttl(key(token));
  await redis.set(key(token), JSON.stringify(s), 'EX', ttl > 0 ? ttl : LOGIN_TTL);
}

export const normalizePhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  return '+' + (d.length === 9 ? '998' + d : d);
};

export const homeFor = (role: string, staff = false) => (role === 'admin' ? '/admin' : role === 'owner' || staff ? '/owner' : '/home');

async function staffOf(userId: string) {
  return (await prisma.stadiumStaff.count({ where: { userId } })) > 0;
}

async function finish(res: import('express').Response, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.status === 'blocked') throw new HttpError(403, 'Hisobingiz bloklangan', 'blocked');
  const staff = await staffOf(user.id);
  setAuthCookie(res, signToken(user, staff));
  return { status: 'done', user: publicUser(user), redirect: homeFor(user.role, staff) };
}

async function uniqueUsername(base: string) {
  const slug = base.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20) || 'futbolchi';
  for (let i = 0; i < 20; i++) {
    const u = i === 0 ? slug : `${slug}${Math.floor(Math.random() * 900 + 100)}`;
    if (!(await prisma.user.findUnique({ where: { username: u } }))) return u;
  }
  return `${slug}${Date.now() % 100000}`;
}

/** 1-qadam: bir martalik kirish havolasi (3 daqiqa) */
authRouter.post('/telegram', ah(async (_req, res) => {
  const token = crypto.randomBytes(12).toString('base64url');
  await redis.set(key(token), JSON.stringify({ status: 'pending' } satisfies LoginState), 'EX', LOGIN_TTL);
  res.json({ token, url: `https://t.me/${env.botUsername}?start=${token}`, expiresIn: LOGIN_TTL, devShare: env.devLogin });
}));

/** 2-qadam: sayt holatni so‘rab turadi */
authRouter.get('/telegram/:token', ah(async (req, res) => {
  const s = await getLogin(req.params.token);
  if (!s) throw new HttpError(410, 'Havola muddati tugadi. Qaytadan urinib ko‘ring.', 'expired');
  if (s.status === 'pending') return res.json({ status: 'pending' });
  const user = await prisma.user.findFirst({ where: { OR: [{ telegramId: BigInt(s.telegramId) }, { phone: s.phone }] } });
  if (user) {
    if (!user.telegramId) await prisma.user.update({ where: { id: user.id }, data: { telegramId: BigInt(s.telegramId) } });
    await redis.del(key(req.params.token));
    return res.json(await finish(res, user.id));
  }
  res.json({ status: 'need_role', name: s.firstName ?? '' });
}));

/** 3-qadam (yangi foydalanuvchi): rol tanlash */
authRouter.post('/telegram/:token/complete', ah(async (req, res) => {
  const body = parse(z.object({ role: z.enum(['player', 'owner']), name: z.string().trim().min(2).max(60) }), req.body);
  const s = await getLogin(req.params.token);
  if (!s) throw new HttpError(410, 'Havola muddati tugadi. Qaytadan urinib ko‘ring.', 'expired');
  if (s.status !== 'shared') throw bad('Avval Telegram botda raqamingizni ulashing');
  const exists = await prisma.user.findFirst({ where: { OR: [{ telegramId: BigInt(s.telegramId) }, { phone: s.phone }] } });
  const user = exists ?? await prisma.user.create({
    data: {
      name: body.name, role: body.role, phone: s.phone, telegramId: BigInt(s.telegramId),
      username: await uniqueUsername(s.username || body.name.split(' ')[0]), district: 'Yunusobod',
      ...(body.role === 'owner' ? { ownerProfile: { create: {} } } : {}),
    },
  });
  await redis.del(key(req.params.token));
  res.json(await finish(res, user.id));
}));

/** Faqat lokal sinov: botdagi "Raqamni ulashish" tugmasini taqlid qiladi */
authRouter.post('/telegram/:token/dev-share', ah(async (req, res) => {
  if (!env.devLogin) throw new HttpError(404, 'Topilmadi');
  const body = parse(z.object({ phone: z.string().min(9), name: z.string().optional() }), req.body);
  const s = await getLogin(req.params.token);
  if (!s) throw new HttpError(410, 'Havola muddati tugadi', 'expired');
  const phone = normalizePhone(body.phone);
  const existing = await prisma.user.findUnique({ where: { phone } });
  const telegramId = existing?.telegramId?.toString() ?? String(BigInt('0x' + crypto.createHash('sha1').update(phone).digest('hex').slice(0, 10)));
  await setLogin(req.params.token, { status: 'shared', phone, telegramId, firstName: body.name });
  res.json({ ok: true });
}));

authRouter.get('/me', ah(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Kirilmagan', code: 'unauthorized' });
  const staff = await staffOf(req.user.id);
  const [unread, unreadChats] = await Promise.all([
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
    unreadChatCount(req.user.id),
  ]);
  res.json({ user: publicUser(req.user), staff, home: homeFor(req.user.role, staff), unread, unreadChats });
}));

export async function unreadChatCount(userId: string) {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(DISTINCT cm.chat_id) AS n FROM chat_members cm
    JOIN messages m ON m.chat_id = cm.chat_id
    WHERE cm.user_id = ${userId}::uuid AND m.sender_id <> ${userId}::uuid
      AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)`;
  return Number(rows[0]?.n ?? 0);
}

authRouter.get('/ws-token', requireAuth, (req, res) => {
  res.json({ token: signWsToken(req.user!.id) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});
