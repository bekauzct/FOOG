import { Router, type Request } from 'express';
import { z } from 'zod';
import type { FoogiAudience, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { redis } from '../redis';
import { ah, bad, HttpError, notFound, parse, qstr } from '../http';
import { requireRole } from '../auth';
import { audit } from '../notify';
import { ANSWER_AT, SUGGEST_AT, bust, normalize, rank } from '../foogi/engine';

// ================= FOOGI – hamma uchun (mehmon ham) =================
export const foogiRouter = Router();

const audienceOf = (req: Request): FoogiAudience => (req.user ? (req.user.role as FoogiAudience) : 'guest');
const forAud = (a: FoogiAudience): Prisma.EnumFoogiAudienceFilter => ({ in: a === 'admin' ? ['all', 'admin', 'player', 'owner', 'guest'] : ['all', a] });
const FALLBACK = 'Hmm, buni hali o‘rganyapman – savolingizni adminga yubordim, tez orada javob berishni o‘rganaman. Hozircha stadion, bron, to‘lov, jamoa, o‘yin yoki Reels haqida so‘rang.';
const answerOut = (a: { id: string; title: string; answer: string; pose: string; linkHref: string | null; linkLabel: string | null }) =>
  ({ answerId: a.id, title: a.title, text: a.answer, pose: a.pose, href: a.linkHref, label: a.linkLabel });

/** Sahifa uchun: sayr qadamlari, takliflar va tezkor tugmalar */
foogiRouter.get('/boot', ah(async (req, res) => {
  const aud = audienceOf(req);
  const page = qstr(req.query.page) ?? 'page';
  const path = qstr(req.query.path) ?? '/';
  const [steps, site, tips, top] = await Promise.all([
    prisma.foogiTourStep.findMany({ where: { page, active: true, audience: forAud(aud) }, orderBy: { sort: 'asc' } }),
    prisma.foogiTourStep.findMany({ where: { page: 'site', active: true, audience: aud === 'guest' ? { in: [] } : { in: [aud] } }, orderBy: { sort: 'asc' } }),
    prisma.foogiTip.findMany({ where: { active: true, audience: { in: ['all', aud] } }, orderBy: { sort: 'asc' } }),
    prisma.foogiAnswer.findMany({ where: { active: true, audience: forAud(aud), linkHref: { not: null } }, orderBy: [{ hits: 'desc' }, { createdAt: 'asc' }], take: 5, select: { id: true, title: true } }),
  ]);
  const step = (s: (typeof steps)[number]) => ({ id: s.id, target: s.target, title: s.title, text: s.text, pose: s.pose });
  res.json({
    audience: aud,
    tour: steps.map(step),
    site: site.map(step),
    tips: tips.filter((t) => !t.page || path === t.page || path.startsWith(t.page + '/')).map((t) => ({ id: t.id, title: t.title, text: t.text, pose: t.pose, label: t.ctaLabel, href: t.ctaHref })),
    chips: top.map((a) => ({ answerId: a.id, title: a.title })),
  });
}));

const askBody = z.object({ text: z.string().trim().max(300).optional(), answerId: z.string().uuid().optional(), page: z.string().max(40).optional() });
foogiRouter.post('/ask', ah(async (req, res) => {
  const b = parse(askBody, req.body);
  const aud = audienceOf(req);
  // oddiy cheklov: daqiqasiga 30 ta savol
  const rk = `foogi:rl:${req.user?.id ?? req.ip}`;
  const n = await redis.incr(rk); if (n === 1) await redis.expire(rk, 60);
  if (n > 30) throw new HttpError(429, 'Juda ko‘p savol – bir daqiqadan keyin yozing', 'rate_limited');
  if (b.answerId) {
    const a = await prisma.foogiAnswer.findFirst({ where: { id: b.answerId, active: true } });
    if (!a) throw notFound();
    await prisma.foogiAnswer.update({ where: { id: a.id }, data: { hits: { increment: 1 } } });
    return res.json({ matched: true, ...answerOut(a) });
  }
  if (!b.text) throw bad('Savolni yozing');
  const top = await rank(b.text, aud, 3);
  const best = top[0];
  const ok = !!best && best.score >= ANSWER_AT;
  const log = await prisma.foogiQuestion.create({ data: { text: b.text, page: b.page ?? null, userId: req.user?.id ?? null, audience: aud, answerId: ok ? best.answer.id : null, score: best?.score ?? 0, status: ok ? 'answered' : 'unanswered' } });
  if (ok) {
    await prisma.foogiAnswer.update({ where: { id: best.answer.id }, data: { hits: { increment: 1 } } });
    return res.json({ id: log.id, matched: true, score: best.score, ...answerOut(best.answer) });
  }
  const sug = top.filter((m) => m.score >= SUGGEST_AT).slice(0, 3).map((m) => ({ answerId: m.answer.id, title: m.answer.title }));
  res.json({ id: log.id, matched: false, pose: sug.length ? 'thinking' : 'facepalm', text: sug.length ? 'Aniq tushunmadim. Shulardan birini nazarda tutdingizmi?' : FALLBACK, suggestions: sug });
}));

foogiRouter.post('/feedback', ah(async (req, res) => {
  const b = parse(z.object({ id: z.string().uuid(), helpful: z.boolean() }), req.body);
  const q = await prisma.foogiQuestion.findUnique({ where: { id: b.id } });
  if (!q || (q.userId && q.userId !== req.user?.id)) throw notFound();
  await prisma.foogiQuestion.update({ where: { id: q.id }, data: { helpful: b.helpful, ...(b.helpful ? {} : { status: 'wrong' }) } });
  res.json({ ok: true });
}));

// ================= Admin: FOOGI’ni o‘rgatish =================
export const adminFoogiRouter = Router();
adminFoogiRouter.use(requireRole('admin'));
const AUD = z.enum(['all', 'guest', 'player', 'owner', 'admin']);
const lines = z.array(z.string().trim().min(1).max(200)).max(60);
const answerBody = z.object({
  title: z.string().trim().min(2).max(80), questions: lines, keywords: z.array(z.string().trim().min(1).max(40)).max(40),
  answer: z.string().trim().min(2).max(800), pose: z.string().trim().max(40).default('thumbs_up'),
  linkHref: z.string().trim().max(200).regex(/^\/[^\s]*$/, 'Havola / bilan boshlanadi').nullable().optional(), linkLabel: z.string().trim().max(40).nullable().optional(),
  audience: AUD.default('all'), active: z.boolean().default(true),
});
const OPEN: Prisma.FoogiQuestionWhereInput = { status: { in: ['unanswered', 'wrong'] } };

adminFoogiRouter.get('/stats', ah(async (_req, res) => {
  const day = new Date(Date.now() - 864e5);
  const [open, answers, tips, steps, asked, answered] = await Promise.all([
    prisma.foogiQuestion.count({ where: OPEN }), prisma.foogiAnswer.count(), prisma.foogiTip.count(), prisma.foogiTourStep.count(),
    prisma.foogiQuestion.count({ where: { createdAt: { gte: day } } }), prisma.foogiQuestion.count({ where: { createdAt: { gte: day }, status: 'answered' } }),
  ]);
  res.json({ open, answers, tips, steps, asked24: asked, answered24: answered });
}));

// --- savollar navbati
adminFoogiRouter.get('/questions', ah(async (req, res) => {
  const st = qstr(req.query.status) ?? 'open';
  const q = qstr(req.query.q);
  const where: Prisma.FoogiQuestionWhereInput = { ...(st === 'open' ? OPEN : st === 'all' ? {} : { status: st as never }), ...(q ? { text: { contains: q, mode: 'insensitive' } } : {}) };
  const rows = await prisma.foogiQuestion.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { answer: { select: { id: true, title: true } } } });
  // bir xil savollarni guruhlash: normallashtirilgan matn bo‘yicha
  const groups = new Map<string, { key: string; text: string; count: number; ids: string[]; last: Date; page: string | null; status: string; answer: { id: string; title: string } | null; score: number; audience: string }>();
  for (const r of rows) {
    const k = normalize(r.text);
    const g = groups.get(k);
    if (g) { g.count++; g.ids.push(r.id); } else groups.set(k, { key: k, text: r.text, count: 1, ids: [r.id], last: r.createdAt, page: r.page, status: r.status, answer: r.answer, score: r.score, audience: r.audience });
  }
  res.json({ items: [...groups.values()] });
}));
const idsBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });
adminFoogiRouter.post('/questions/teach', ah(async (req, res) => {
  const b = parse(idsBody.extend({ answerId: z.string().uuid().optional(), create: answerBody.optional() }), req.body);
  const qs = await prisma.foogiQuestion.findMany({ where: { id: { in: b.ids } } });
  if (!qs.length) throw notFound('Savol topilmadi');
  const texts = [...new Set(qs.map((q) => q.text.trim()))];
  let answerId = b.answerId;
  if (b.create) {
    const a = await prisma.foogiAnswer.create({ data: { ...b.create, questions: [...new Set([...b.create.questions, ...texts])], linkHref: b.create.linkHref ?? null, linkLabel: b.create.linkLabel ?? null } });
    answerId = a.id;
  } else {
    if (!answerId) throw bad('Javobni tanlang');
    const a = await prisma.foogiAnswer.findUnique({ where: { id: answerId } });
    if (!a) throw notFound('Javob topilmadi');
    await prisma.foogiAnswer.update({ where: { id: a.id }, data: { questions: [...new Set([...a.questions, ...texts])] } });
  }
  await prisma.foogiQuestion.updateMany({ where: { id: { in: b.ids } }, data: { status: 'taught', answerId } });
  bust();
  await audit(req.user!.id, 'foogi.teach', `FOOGI’ga o‘rgatdi: «${texts[0]}»${texts.length > 1 ? ` va yana ${texts.length - 1} ta` : ''}`, 'foogi', answerId);
  res.json({ ok: true, answerId });
}));
adminFoogiRouter.post('/questions/dismiss', ah(async (req, res) => {
  const b = parse(idsBody, req.body);
  await prisma.foogiQuestion.updateMany({ where: { id: { in: b.ids } }, data: { status: 'dismissed' } });
  res.json({ ok: true });
}));

// --- bilimlar (javoblar)
adminFoogiRouter.get('/answers', ah(async (req, res) => {
  const q = qstr(req.query.q);
  const rows = await prisma.foogiAnswer.findMany({ where: q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { answer: { contains: q, mode: 'insensitive' } }, { questions: { has: q } }] } : {}, orderBy: [{ active: 'desc' }, { hits: 'desc' }, { title: 'asc' }] });
  res.json({ items: rows });
}));
adminFoogiRouter.post('/answers', ah(async (req, res) => {
  const b = parse(answerBody, req.body);
  const a = await prisma.foogiAnswer.create({ data: { ...b, linkHref: b.linkHref ?? null, linkLabel: b.linkLabel ?? null } });
  bust(); await audit(req.user!.id, 'foogi.answer', `FOOGI bilimi qo‘shdi: «${a.title}»`, 'foogi', a.id);
  res.status(201).json(a);
}));
adminFoogiRouter.put('/answers/:id', ah(async (req, res) => {
  const b = parse(answerBody, req.body);
  const a = await prisma.foogiAnswer.update({ where: { id: req.params.id }, data: { ...b, linkHref: b.linkHref ?? null, linkLabel: b.linkLabel ?? null } }).catch(() => { throw notFound(); });
  bust(); await audit(req.user!.id, 'foogi.answer', `FOOGI bilimini tahrirladi: «${a.title}»`, 'foogi', a.id);
  res.json(a);
}));
adminFoogiRouter.delete('/answers/:id', ah(async (req, res) => {
  const a = await prisma.foogiAnswer.delete({ where: { id: req.params.id } }).catch(() => { throw notFound(); });
  bust(); await audit(req.user!.id, 'foogi.answer', `FOOGI bilimini o‘chirdi: «${a.title}»`, 'foogi', a.id);
  res.json({ ok: true });
}));
/** Sinov maydoni: savol → eng mos 5 ta javob va ball */
adminFoogiRouter.post('/test', ah(async (req, res) => {
  const b = parse(z.object({ text: z.string().trim().min(1).max(300), audience: AUD.exclude(['all']).default('player') }), req.body);
  const top = await rank(b.text, b.audience, 5);
  res.json({ answerAt: ANSWER_AT, suggestAt: SUGGEST_AT, normalized: normalize(b.text), items: top.map((m) => ({ id: m.answer.id, title: m.answer.title, score: Math.round(m.score * 100) / 100, answer: m.answer.answer })) });
}));

// --- takliflar
const tipBody = z.object({ title: z.string().trim().max(80).nullable().optional(), text: z.string().trim().min(2).max(300), pose: z.string().trim().max(40).default('present'), ctaLabel: z.string().trim().max(30).nullable().optional(), ctaHref: z.string().trim().max(200).regex(/^\/[^\s]*$/).nullable().optional(), audience: AUD.default('all'), page: z.string().trim().max(60).regex(/^\/[^\s]*$/).nullable().optional(), sort: z.number().int().min(0).max(999).default(0), active: z.boolean().default(true) });
adminFoogiRouter.get('/tips', ah(async (_req, res) => { res.json({ items: await prisma.foogiTip.findMany({ orderBy: [{ audience: 'asc' }, { sort: 'asc' }] }) }); }));
adminFoogiRouter.post('/tips', ah(async (req, res) => { const b = parse(tipBody, req.body); res.status(201).json(await prisma.foogiTip.create({ data: { ...b, title: b.title ?? null, ctaLabel: b.ctaLabel ?? null, ctaHref: b.ctaHref ?? null, page: b.page ?? null } })); }));
adminFoogiRouter.put('/tips/:id', ah(async (req, res) => { const b = parse(tipBody, req.body); res.json(await prisma.foogiTip.update({ where: { id: req.params.id }, data: { ...b, title: b.title ?? null, ctaLabel: b.ctaLabel ?? null, ctaHref: b.ctaHref ?? null, page: b.page ?? null } }).catch(() => { throw notFound(); })); }));
adminFoogiRouter.delete('/tips/:id', ah(async (req, res) => { await prisma.foogiTip.delete({ where: { id: req.params.id } }).catch(() => { throw notFound(); }); res.json({ ok: true }); }));

// --- sayr qadamlari
const stepBody = z.object({ page: z.string().trim().min(2).max(40), target: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(300), pose: z.string().trim().max(40).default('present'), audience: AUD.default('all'), sort: z.number().int().min(0).max(9999).default(0), active: z.boolean().default(true) });
adminFoogiRouter.get('/tour', ah(async (_req, res) => { res.json({ items: await prisma.foogiTourStep.findMany({ orderBy: [{ page: 'asc' }, { sort: 'asc' }] }) }); }));
adminFoogiRouter.post('/tour', ah(async (req, res) => { res.status(201).json(await prisma.foogiTourStep.create({ data: parse(stepBody, req.body) })); }));
adminFoogiRouter.put('/tour/:id', ah(async (req, res) => { res.json(await prisma.foogiTourStep.update({ where: { id: req.params.id }, data: parse(stepBody, req.body) }).catch(() => { throw notFound(); })); }));
adminFoogiRouter.delete('/tour/:id', ah(async (req, res) => { await prisma.foogiTourStep.delete({ where: { id: req.params.id } }).catch(() => { throw notFound(); }); res.json({ ok: true }); }));
