import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { redis } from '../redis';
import { ah, bad, conflict, forbidden, notFound, parse, qstr } from '../http';
import { requireAuth, requireRole } from '../auth';
import { publicUrl, UPLOAD_ROOT } from '../uploads';
import { audit, notify } from '../notify';
import { mondayOf, tashkentParts } from '../time';

/**
 * Jonglyor Battle. To‘pni yerga tushirmasdan oyoqda o‘ynatish: 1 ta = 1 ball.
 * Video faqat sayt ichida, kameradan yoziladi (yuklash yo‘q): /start bir martalik kod beradi, u videoga yoziladi;
 * server yozish vaqtini o‘zi o‘lchaydi va video uzunligi bilan solishtiradi. Sonni foydalanuvchi kiritadi, moderator tasdiqlaydi.
 * Reyting – shaxsiy rekord bo‘yicha; jami ball – tasdiqlangan urinishlar yig‘indisi (kuniga 3 ta urinish).
 */
const run = promisify(execFile);
export const JUGGLE_DAILY = 3;
export const JUGGLE_MAX_SEC = 120;
const SESSION_TTL = 20 * 60; // yozish + son kiritish + yuklash uchun
const key = (t: string) => `juggle:${t}`;
type Session = { userId: string; code: string; startedAt: number; stoppedAt?: number };

const DIR = path.join(UPLOAD_ROOT, 'juggle');
fs.mkdirSync(DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: DIR, filename: (_r, f, cb) => cb(null, crypto.randomUUID() + (f.mimetype.includes('mp4') ? '.mp4' : '.webm')) }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => (/^video\/(webm|mp4|quicktime)/.test(f.mimetype) ? cb(null, true) : cb(bad('Video formati noto‘g‘ri'))),
});

/** Toshkent vaqti bo‘yicha bugun 00:00 (UTC Date) */
const dayStart = (date = tashkentParts().date) => new Date(`${date}T00:00:00+05:00`);
const todayCount = (userId: string) => prisma.juggleAttempt.count({ where: { userId, createdAt: { gte: dayStart() }, status: { not: 'failed' } } });

async function statsOf(userId: string) {
  const [agg, best] = await Promise.all([
    prisma.juggleAttempt.aggregate({ where: { userId, status: 'approved' }, _sum: { count: true }, _count: true }),
    prisma.juggleAttempt.findFirst({ where: { userId, status: 'approved' }, orderBy: [{ count: 'desc' }, { createdAt: 'asc' }], select: { id: true, count: true, videoUrl: true, posterUrl: true, createdAt: true } }),
  ]);
  let rank: number | null = null;
  if (best?.count) {
    const better = await prisma.juggleAttempt.groupBy({ by: ['userId'], where: { status: 'approved', user: { status: 'active' } }, _max: { count: true }, having: { count: { _max: { gt: best.count } } } });
    rank = better.length + 1;
  }
  return { best: best?.count ?? 0, total: agg._sum.count ?? 0, approved: agg._count, rank, record: best ? { id: best.id, videoUrl: best.videoUrl, posterUrl: best.posterUrl, createdAt: best.createdAt } : null };
}

export const juggleRouter = Router();

/** Reyting: shaxsiy rekord bo‘yicha. period=week – shu hafta (Dushanbadan) tasdiqlangan urinishlar; district – tuman */
juggleRouter.get('/leaderboard', ah(async (req, res) => {
  const period = req.query.period === 'week' ? 'week' : 'all';
  const district = qstr(req.query.district);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
  const where: Prisma.JuggleAttemptWhereInput = {
    status: 'approved',
    user: { status: 'active', ...(district ? { district } : {}) },
    ...(period === 'week' ? { createdAt: { gte: dayStart(mondayOf(tashkentParts().date)) } } : {}),
  };
  const rows = await prisma.juggleAttempt.groupBy({ by: ['userId'], where, _max: { count: true }, orderBy: { _max: { count: 'desc' } }, take: limit });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, username: true, avatarUrl: true, district: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json({ period, district: district ?? null, items: rows.map((r, i) => ({ rank: i + 1, best: r._max.count ?? 0, user: byId.get(r.userId) })).filter((x) => x.user) });
}));

/** Profil uchun: foydalanuvchining rekordi, jami bali va rekord videosi */
juggleRouter.get('/user/:username', ah(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { username: req.params.username }, select: { id: true } });
  if (!u) throw notFound('Foydalanuvchi topilmadi');
  res.json(await statsOf(u.id));
}));

juggleRouter.get('/me', requireAuth, ah(async (req, res) => {
  const me = req.user!;
  const [stats, used, items] = await Promise.all([
    statsOf(me.id), todayCount(me.id),
    prisma.juggleAttempt.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, claimed: true, count: true, status: true, videoUrl: true, posterUrl: true, rejectReason: true, createdAt: true } }),
  ]);
  res.json({ ...stats, todayLeft: Math.max(0, JUGGLE_DAILY - used), daily: JUGGLE_DAILY, maxSec: JUGGLE_MAX_SEC, items });
}));

/** 1-qadam: yozishni boshlash – bir martalik kod (videoga yoziladi) */
juggleRouter.post('/start', requireAuth, ah(async (req, res) => {
  const me = req.user!;
  if ((await todayCount(me.id)) >= JUGGLE_DAILY) throw conflict(`Bugungi ${JUGGLE_DAILY} ta urinish tugadi. Ertaga yana urinib ko‘ring.`, 'limit');
  // Ko‘p marta boshlab tashlab ketishni cheklash
  const starts = await redis.incr(`juggle-starts:${me.id}:${tashkentParts().date}`);
  if (starts === 1) await redis.expire(`juggle-starts:${me.id}:${tashkentParts().date}`, 26 * 3600);
  if (starts > 30) throw conflict('Bugun juda ko‘p marta boshladingiz. Ertaga urinib ko‘ring.', 'limit');
  const token = crypto.randomBytes(12).toString('base64url');
  const code = `FG-${crypto.randomInt(1000, 10000)}`;
  await redis.set(key(token), JSON.stringify({ userId: me.id, code, startedAt: Date.now() } satisfies Session), 'EX', SESSION_TTL);
  res.json({ token, code, maxSec: JUGGLE_MAX_SEC });
}));

async function sessionOf(token: string, userId: string) {
  const raw = await redis.get(key(token));
  if (!raw) throw new (class extends Error {})('');
  const s = JSON.parse(raw) as Session;
  if (s.userId !== userId) throw forbidden();
  return s;
}

/** 2-qadam: yozish tugadi – server vaqtni qayd qiladi */
juggleRouter.post('/:token/stop', requireAuth, ah(async (req, res) => {
  const s = await sessionOf(req.params.token, req.user!.id).catch((e) => { if (e?.status) throw e; throw bad('Yozish sessiyasi topilmadi. Qaytadan boshlang.', 'expired'); });
  if (!s.stoppedAt) {
    s.stoppedAt = Date.now();
    await redis.set(key(req.params.token), JSON.stringify(s), 'KEEPTTL');
  }
  res.json({ elapsedSec: (s.stoppedAt - s.startedAt) / 1000 });
}));

/** 3-qadam: video va foydalanuvchi kiritgan son */
juggleRouter.post('/:token/submit', requireAuth, upload.single('video'), ah(async (req, res) => {
  const me = req.user!;
  const drop = () => { if (req.file) fs.rm(req.file.path, () => undefined); };
  try {
    const s = await sessionOf(req.params.token, me.id).catch((e) => { if (e?.status) throw e; throw bad('Yozish sessiyasi muddati tugadi. Qaytadan yozing.', 'expired'); });
    if (!req.file) throw bad('Video kelmadi');
    if (!s.stoppedAt) throw bad('Yozish tugatilmagan');
    const { count } = parse(z.object({ count: z.coerce.number().int().min(1, 'Kamida 1 ta').max(9999) }), req.body);
    if ((await todayCount(me.id)) >= JUGGLE_DAILY) throw conflict(`Bugungi ${JUGGLE_DAILY} ta urinish tugadi.`, 'limit');
    await redis.del(key(req.params.token)); // bir martalik
    const elapsedSec = (s.stoppedAt - s.startedAt) / 1000;
    const a = await prisma.juggleAttempt.create({ data: { userId: me.id, claimed: count, code: s.code, elapsedSec } });
    res.json({ id: a.id, status: a.status });
    void processVideo(a.id, req.file.path, elapsedSec);
  } catch (e) {
    drop();
    throw e;
  }
}));

/** Videoni hamma brauzerda ochiladigan MP4 ga o‘tkazish, uzunlikni server o‘lchagan vaqt bilan solishtirish */
async function processVideo(id: string, input: string, elapsedSec: number) {
  const base = path.basename(input, path.extname(input));
  const outName = `${base}-720.mp4`, posterName = `${base}.jpg`;
  const out = path.join(DIR, outName), poster = path.join(DIR, posterName);
  const fail = async (reason: string) => {
    const a = await prisma.juggleAttempt.update({ where: { id }, data: { status: 'failed', rejectReason: reason } });
    await notify(a.userId, { type: 'system', kind: 'juggle_failed', title: 'Jonglyor videosi qabul qilinmadi', body: reason, refType: 'juggle', refId: id });
  };
  try {
    await run('ffmpeg', ['-y', '-i', input, '-t', String(JUGGLE_MAX_SEC + 2), '-an', '-vf', "scale='min(720,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { timeout: 6 * 60 * 1000 });
    const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]);
    const dur = parseFloat(probe.stdout);
    fs.rm(input, () => undefined);
    if (!isFinite(dur) || dur < 2) return void (await fail('Video juda qisqa yoki o‘qib bo‘lmadi.'));
    // Video sayt ichida, shu sessiyada yozilganini tekshirish: uzunligi server o‘lchagan vaqtdan oshmasligi va juda qisqa bo‘lmasligi kerak
    if (dur > elapsedSec + 3 || dur < elapsedSec - 8) return void (await fail('Video uzunligi yozish vaqtiga mos kelmadi. Qaytadan sayt ichida yozing.'));
    await run('ffmpeg', ['-y', '-ss', String(Math.min(1, dur / 2)), '-i', out, '-frames:v', '1', '-q:v', '4', poster]);
    await prisma.juggleAttempt.update({ where: { id }, data: { status: 'pending', videoUrl: publicUrl('juggle', outName), posterUrl: publicUrl('juggle', posterName), durationSec: dur } });
  } catch (e) {
    console.warn('[juggle] video xatosi', (e as Error).message);
    fs.rm(input, () => undefined);
    await fail('Videoni qayta ishlab bo‘lmadi. Qaytadan urinib ko‘ring.').catch(() => undefined);
  }
}

/** Server qayta ishga tushganda yarim yo‘lda qolgan videolar */
export const failStuckJuggles = () => prisma.juggleAttempt.updateMany({ where: { status: 'processing', createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }, data: { status: 'failed', rejectReason: 'Videoni qayta ishlab bo‘lmadi. Qaytadan urinib ko‘ring.' } });

// ---------------------------------------------------------------- moderatsiya
export const adminJuggleRouter = Router();
adminJuggleRouter.use(requireRole('admin'));

adminJuggleRouter.get('/', ah(async (req, res) => {
  const status = (['pending', 'approved', 'rejected', 'failed', 'processing'] as const).find((s) => s === req.query.status) ?? 'pending';
  const [items, counts] = await Promise.all([
    prisma.juggleAttempt.findMany({
      where: { status }, orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' }, take: 100,
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, district: true } }, reviewedBy: { select: { name: true } } },
    }),
    prisma.juggleAttempt.groupBy({ by: ['status'], _count: true }),
  ]);
  const best = await prisma.juggleAttempt.groupBy({ by: ['userId'], where: { status: 'approved', userId: { in: [...new Set(items.map((i) => i.userId))] } }, _max: { count: true } });
  const bestOf = new Map(best.map((b) => [b.userId, b._max.count ?? 0]));
  res.json({
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    items: items.map((a) => ({ id: a.id, user: a.user, claimed: a.claimed, count: a.count, status: a.status, code: a.code, videoUrl: a.videoUrl, posterUrl: a.posterUrl, durationSec: a.durationSec, elapsedSec: a.elapsedSec, rejectReason: a.rejectReason, reviewedBy: a.reviewedBy?.name ?? null, reviewedAt: a.reviewedAt, createdAt: a.createdAt, userBest: bestOf.get(a.userId) ?? 0 })),
  });
}));

export const JUGGLE_REJECT = ['Kod videoda ko‘rinmaydi', 'Video uzluksiz emas', 'Tana to‘liq ko‘rinmaydi', 'Son noto‘g‘ri – to‘p yerga tushgan', 'Boshqa odam'];
adminJuggleRouter.patch('/:id', ah(async (req, res) => {
  const body = parse(z.discriminatedUnion('action', [
    z.object({ action: z.literal('approve'), count: z.number().int().min(1).max(9999).optional() }),
    z.object({ action: z.literal('reject'), reason: z.string().trim().min(3).max(200) }),
  ]), req.body);
  const a = await prisma.juggleAttempt.findUnique({ where: { id: req.params.id }, include: { user: { select: { username: true } } } });
  if (!a) throw notFound('Urinish topilmadi');
  if (a.status !== 'pending' && a.status !== 'approved' && a.status !== 'rejected') throw bad('Bu urinish hali tekshirishga tayyor emas');
  const me = req.user!;
  if (body.action === 'approve') {
    const count = body.count ?? a.claimed;
    const prev = await prisma.juggleAttempt.aggregate({ where: { userId: a.userId, status: 'approved', id: { not: a.id } }, _max: { count: true } });
    await prisma.juggleAttempt.update({ where: { id: a.id }, data: { status: 'approved', count, rejectReason: null, reviewedById: me.id, reviewedAt: new Date() } });
    const record = count > (prev._max.count ?? 0);
    await notify(a.userId, {
      type: 'system', kind: 'juggle_approved', refType: 'juggle', refId: a.id,
      title: record ? `🏆 Yangi rekord: ${count} ta jonglyor!` : `Jonglyor tasdiqlandi: ${count} ta`,
      body: count !== a.claimed ? `Siz ${a.claimed} ta deb kiritgandingiz, moderator ${count} ta deb sanadi.` : 'Ball FOOG ID’ingizga yozildi.',
      telegram: record ? `🏆 <b>Yangi rekord: ${count} ta jonglyor!</b>\nBall FOOG ID’ingizga yozildi.` : undefined,
    });
    await audit(me.id, 'juggle.approve', `@${a.user.username} jonglyorini tasdiqladi: ${count} ta${count !== a.claimed ? ` (kiritgani ${a.claimed})` : ''}`, 'juggle', a.id);
  } else {
    await prisma.juggleAttempt.update({ where: { id: a.id }, data: { status: 'rejected', count: null, rejectReason: body.reason, reviewedById: me.id, reviewedAt: new Date() } });
    await notify(a.userId, { type: 'system', kind: 'juggle_rejected', title: 'Jonglyor videosi rad etildi', body: body.reason, refType: 'juggle', refId: a.id });
    await audit(me.id, 'juggle.reject', `@${a.user.username} jonglyorini rad etdi: ${body.reason}`, 'juggle', a.id);
  }
  res.json({ ok: true });
}));

