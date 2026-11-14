import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, notFound, parse, qstr } from '../http';
import { requireAuth, requireRole } from '../auth';
import { audit } from '../notify';

/**
 * online.obyektivka ma’lumotlari. Tahrirlovchi (foog.uz/obyektivka) brauzerdan shu yerga saqlaydi:
 * foydalanuvchi keyin boshqa qurilmada davom ettira oladi, kelajakda rezyume va boshqa hujjatlar shu ma’lumotdan to‘ldiriladi.
 * Maydon nomlari va chegaralari Obyektivka ilovasidagi sxema (apps/obyektivka/schemas.py) bilan bir xil.
 */
const S = (max: number) => z.string().max(max).default('');
const TEXT = { fish: 300, lavozim: 2000, tugSana: 20, tugJoy: 300, millati: 300, partiya: 300, malumoti: 300, tamomlagan: 2000, mutaxassislik: 300, ilmiyDaraja: 300, ilmiyUnvon: 300, tillar: 300, mukofot: 2000, deputat: 2000 } as const;
const PHOTO_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const dataSchema = z.object({
  lang: z.enum(['new', 'lat', 'cyr', 'ru']).default('lat'),
  ...(Object.fromEntries(Object.entries(TEXT).map(([k, n]) => [k, S(n)])) as { [K in keyof typeof TEXT]: ReturnType<typeof S> }),
  mehnat: z.array(z.object({ dan: S(10), gacha: S(10), matn: S(2000) })).max(60).default([]),
  qarindosh: z.array(z.object({ rel: S(300), fish: S(300), yil: S(10), joy: S(300), ish: S(2000), turar: S(2000) })).max(40).default([]),
});
// photo: undefined – o‘zgarmaydi, '' – o‘chiriladi
const bodySchema = z.object({ data: dataSchema, photo: z.string().max(3 * 1024 * 1024).refine((v) => v === '' || PHOTO_RE.test(v), 'Rasm formati noto‘g‘ri').optional() });

const out = (p: { data: Prisma.JsonValue; photo: string | null; updatedAt: Date } | null) => (p ? { data: p.data, photo: p.photo ?? '', updatedAt: p.updatedAt } : { data: null, photo: '', updatedAt: null });
const save = (userId: string, body: z.infer<typeof bodySchema>) => {
  const photo = body.photo === undefined ? undefined : body.photo || null;
  return prisma.obyektivkaProfile.upsert({ where: { userId }, create: { userId, fish: body.data.fish, data: body.data, photo: photo ?? null }, update: { fish: body.data.fish, data: body.data, ...(photo !== undefined ? { photo } : {}) } });
};

export const obyektivkaRouter = Router();
obyektivkaRouter.use(requireAuth);
// ?meta=1 – faqat o‘zgargan vaqt (tahrirlovchi yangiroq nusxa bor-yo‘qligini tekshiradi)
obyektivkaRouter.get('/me', ah(async (req, res) => {
  if (req.query.meta) {
    const p = await prisma.obyektivkaProfile.findUnique({ where: { userId: req.user!.id }, select: { updatedAt: true } });
    return res.json({ updatedAt: p?.updatedAt ?? null });
  }
  res.json(out(await prisma.obyektivkaProfile.findUnique({ where: { userId: req.user!.id } })));
}));
obyektivkaRouter.put('/me', ah(async (req, res) => {
  const p = await save(req.user!.id, parse(bodySchema, req.body));
  res.json({ updatedAt: p.updatedAt });
}));
obyektivkaRouter.delete('/me', ah(async (req, res) => {
  await prisma.obyektivkaProfile.deleteMany({ where: { userId: req.user!.id } });
  res.json({ ok: true });
}));

export const adminObyektivkaRouter = Router();
adminObyektivkaRouter.use(requireRole('admin'));
adminObyektivkaRouter.get('/', ah(async (req, res) => {
  const q = qstr(req.query.q);
  const where: Prisma.ObyektivkaProfileWhereInput = q
    ? { OR: [{ fish: { contains: q, mode: 'insensitive' } }, { user: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } }, { phone: { contains: q.replace(/\s/g, '') } }] } }] }
    : {};
  const rows = await prisma.obyektivkaProfile.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200, select: { userId: true, data: true, updatedAt: true, createdAt: true, user: { select: { name: true, username: true, phone: true, avatarUrl: true } } } });
  res.json({
    total: await prisma.obyektivkaProfile.count(),
    items: rows.map((r) => {
      const d = r.data as Record<string, unknown>;
      return { userId: r.userId, user: r.user, fish: String(d.fish ?? ''), lavozim: String(d.lavozim ?? ''), tugSana: String(d.tugSana ?? ''), updatedAt: r.updatedAt, createdAt: r.createdAt };
    }),
  });
}));
adminObyektivkaRouter.get('/:userId', ah(async (req, res) => {
  const p = await prisma.obyektivkaProfile.findUnique({ where: { userId: req.params.userId }, include: { user: { select: { name: true, username: true, phone: true } } } });
  if (!p) throw notFound('Obyektivka topilmadi');
  res.json({ ...out(p), user: p.user });
}));
adminObyektivkaRouter.put('/:userId', ah(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!u) throw notFound('Foydalanuvchi topilmadi');
  const p = await save(u.id, parse(bodySchema, req.body));
  await audit(req.user!.id, 'obyektivka.update', `@${u.username} obyektivkasini tahrirladi`, 'user', u.id);
  res.json({ updatedAt: p.updatedAt });
}));
adminObyektivkaRouter.delete('/:userId', ah(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.userId } });
  const r = await prisma.obyektivkaProfile.deleteMany({ where: { userId: req.params.userId } });
  if (!r.count) throw notFound('Obyektivka topilmadi');
  await audit(req.user!.id, 'obyektivka.delete', `@${u?.username ?? '?'} obyektivkasini o‘chirdi`, 'user', req.params.userId);
  res.json({ ok: true });
}));
