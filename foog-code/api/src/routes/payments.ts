import fs from 'fs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ah, bad, forbidden, notFound, parse, qstr } from '../http';
import { requireAuth, requireRole } from '../auth';
import { audit } from '../notify';
import { miniSelect } from '../serialize';
import { FRAUD_LIMIT, BLOCK_HOURS, PERIOD_DAYS, getInstruction, getTariff, limitOf, setInstruction, setTariff } from '../payments/settings';
import { PROVIDERS, SERVICE_DOWN, fmtCard, maskCard } from '../payments/providers';
import { activeBlock, captainTeam, fmtDT, liftBlock, paymentOut, receiptFile, receiptUpload, startPayment, submitReceipt } from '../payments/service';
import { decideAndSync, sendPaymentToAdmins } from '../payments/adminBot';

// ================= Futbolchi =================
export const paymentsRouter = Router();

const methodOut = (m: { code: string; name: string; description: string | null; badge: string | null; color: string | null; status: string; provider: string }) =>
  ({ code: m.code, name: m.name, description: m.description, badge: m.badge, color: m.color, status: m.status, kind: PROVIDERS[m.provider]?.kind ?? 'gateway' });

/** Tarif, usullar, blok va kapitanning jamoasi – «Jamoam» sahifasi uchun bitta so‘rov */
paymentsRouter.get('/me/team', requireAuth, ah(async (req, res) => {
  const uid = req.user!.id;
  const [t, methods, block, team, pending] = await Promise.all([
    getTariff(),
    prisma.paymentMethod.findMany({ where: { status: { not: 'off' } }, orderBy: { sort: 'asc' } }),
    activeBlock(uid),
    captainTeam(uid),
    prisma.payment.findFirst({ where: { userId: uid, status: 'review' }, orderBy: { submittedAt: 'desc' } }),
  ]);
  const history = await prisma.payment.findMany({ where: { userId: uid, status: { in: ['review', 'approved', 'fraud'] } }, include: { team: { select: { name: true } }, method: { select: { code: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
  let teamOut = null;
  if (team) {
    const members = await prisma.teamMember.findMany({ where: { teamId: team.id }, include: { user: { select: { ...miniSelect, position: true } } }, orderBy: { joinedAt: 'asc' } });
    const chat = await prisma.chat.findFirst({ where: { teamId: team.id }, select: { id: true } });
    teamOut = {
      id: team.id, name: team.name, short: team.short, district: team.district, level: team.level, status: team.status, paidUntil: team.paidUntil,
      limit: limitOf(team, t), chatId: chat?.id ?? null,
      members: members.map((m) => ({ ...m.user, joinedAt: m.joinedAt, captain: m.userId === team.captainId })),
    };
  }
  res.json({
    tariff: { ...t, periodDays: PERIOD_DAYS },
    methods: methods.map(methodOut),
    block: block && { endsAt: block.endsAt, endsT: fmtDT(block.endsAt), reason: block.reason, limit: FRAUD_LIMIT, hours: BLOCK_HOURS },
    pending: pending && paymentOut(pending),
    team: teamOut,
    history: history.map(paymentOut),
    serviceDown: SERVICE_DOWN,
  });
}));

/** To‘lovni boshlash: usul «xabar» rejimida bo‘lsa 503 + «Server vaqtincha ishlamayapti…» */
paymentsRouter.post('/payments', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({
    purpose: z.enum(['team_create', 'team_monthly']),
    method: z.string().max(40),
    teamId: z.string().uuid().optional(),
    team: z.object({ name: z.string().trim().min(2, 'Jamoa nomi kamida 2 harf').max(40), short: z.string().trim().max(4).optional(), district: z.string().max(40).optional(), level: z.enum(['beginner', 'intermediate', 'advanced']).optional(), plays: z.string().max(60).optional() }).optional(),
  }), req.body);
  const r = await startPayment({ id: req.user!.id, role: req.user!.role }, body);
  res.status(201).json({ payment: paymentOut(r.payment), checkout: r.checkout });
}));

/** Chek skrinshoti → tekshiruv → adminlarga Telegram */
paymentsRouter.post('/payments/:id/receipt', requireAuth, receiptUpload.single('file'), ah(async (req, res) => {
  if (!req.file) throw bad('Chek skrinshotini tanlang');
  const p = await submitReceipt(req.params.id, req.user!.id, req.file.filename);
  void sendPaymentToAdmins(p).catch((e) => console.error('[payments] bot', e));
  res.json({ payment: paymentOut(p) });
}));

/** Chek rasmi: faqat egasi va admin */
paymentsRouter.get('/payments/:id/receipt', requireAuth, ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound();
  if (p.userId !== req.user!.id && req.user!.role !== 'admin') throw forbidden();
  const f = receiptFile(p);
  if (!f || !fs.existsSync(f)) throw notFound('Chek topilmadi');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(f);
}));

// ================= Admin =================
export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(requireRole('admin'));

adminPaymentsRouter.get('/badges', ah(async (_req, res) => {
  res.json({ review: await prisma.payment.count({ where: { status: 'review' } }) });
}));

adminPaymentsRouter.get('/requests', ah(async (req, res) => {
  const status = qstr(req.query.status) ?? 'review';
  const q = qstr(req.query.q);
  const where = {
    ...(status === 'all' ? { status: { in: ['review', 'approved', 'fraud'] as ('review' | 'approved' | 'fraud')[] } } : { status: status as 'review' | 'approved' | 'fraud' }),
    ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' as const } }, { user: { name: { contains: q, mode: 'insensitive' as const } } }, { user: { phone: { contains: q.replace(/\D/g, '') || q } } }] } : {}),
  };
  const [rows, counts] = await Promise.all([
    prisma.payment.findMany({ where, include: { user: true, team: { select: { name: true } }, method: { select: { code: true, name: true } }, decidedBy: { select: { name: true } } }, orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.payment.groupBy({ by: ['status'], _count: true, where: { status: { in: ['review', 'approved', 'fraud'] } } }),
  ]);
  res.json({
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    items: rows.map((p) => ({
      ...paymentOut(p),
      user: { id: p.user.id, name: p.user.name, username: p.user.username, phone: p.user.phone, telegramId: p.user.telegramId?.toString() ?? null, fraudStreak: p.user.fraudStreak },
      decidedBy: p.decidedBy?.name ?? (p.decidedVia === 'bot' ? 'Telegram admin' : null), decidedVia: p.decidedVia,
    })),
    fraudLimit: FRAUD_LIMIT,
  });
}));

adminPaymentsRouter.post('/requests/:id/decide', ah(async (req, res) => {
  const { decision } = parse(z.object({ decision: z.enum(['approve', 'fraud']) }), req.body);
  const r = await decideAndSync(req.params.id, decision, { userId: req.user!.id, name: req.user!.name, via: 'web' });
  res.json({ status: r.payment.status, blocked: r.blocked });
}));

adminPaymentsRouter.get('/tariff', ah(async (_req, res) => res.json({ ...(await getTariff()), periodDays: PERIOD_DAYS, fraudLimit: FRAUD_LIMIT, blockHours: BLOCK_HOURS })));
adminPaymentsRouter.put('/tariff', ah(async (req, res) => {
  const body = parse(z.object({ createPrice: z.number().int().min(0).max(100_000_000), monthlyPrice: z.number().int().min(0).max(100_000_000), memberLimit: z.number().int().min(2).max(100) }), req.body);
  const t = await setTariff(body);
  await audit(req.user!.id, 'payment.tariff', `${req.user!.name}: tarifni o‘zgartirdi: ${t.createPrice} / ${t.monthlyPrice} oyiga / ${t.memberLimit} kishi`);
  res.json(t);
}));

// --- To‘lov usullari (modullar)
adminPaymentsRouter.get('/methods', ah(async (_req, res) => {
  const ms = await prisma.paymentMethod.findMany({ orderBy: { sort: 'asc' } });
  res.json({ items: ms.map((m) => ({ ...methodOut(m), id: m.id, provider: m.provider, sort: m.sort })), providers: Object.values(PROVIDERS).map((p) => ({ key: p.key, label: p.label, kind: p.kind })) });
}));
const methodBody = z.object({ code: z.string().trim().regex(/^[a-z0-9_-]{2,30}$/, 'Kod: lotin harflari va raqamlar'), name: z.string().trim().min(2).max(40), provider: z.string().refine((k) => k in PROVIDERS, 'Bunday modul yo‘q'), description: z.string().max(120).optional().nullable(), badge: z.string().max(3).optional().nullable(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(), status: z.enum(['on', 'msg', 'off']), sort: z.number().int().min(0).max(999).optional() });
adminPaymentsRouter.post('/methods', ah(async (req, res) => {
  const b = parse(methodBody, req.body);
  if (b.provider === 'card' && b.status === 'msg') throw bad('Karta usuli uchun «xizmat xabari» rejimi yo‘q');
  const m = await prisma.paymentMethod.create({ data: { ...b, sort: b.sort ?? 100 } });
  await audit(req.user!.id, 'payment.method', `${req.user!.name}: to‘lov usuli qo‘shdi – ${m.name}`);
  res.status(201).json({ id: m.id });
}));
adminPaymentsRouter.patch('/methods/:id', ah(async (req, res) => {
  const b = parse(methodBody.partial(), req.body);
  const prev = await prisma.paymentMethod.findUnique({ where: { id: req.params.id } });
  if (!prev) throw notFound();
  if ((b.provider ?? prev.provider) === 'card' && (b.status ?? prev.status) === 'msg') throw bad('Karta usuli uchun «xizmat xabari» rejimi yo‘q');
  const m = await prisma.paymentMethod.update({ where: { id: prev.id }, data: b });
  await audit(req.user!.id, 'payment.method', `${req.user!.name}: ${m.name} usulini o‘zgartirdi${b.status ? ` → ${b.status}` : ''}`);
  res.json({ ok: true });
}));
adminPaymentsRouter.delete('/methods/:id', ah(async (req, res) => {
  const m = await prisma.paymentMethod.delete({ where: { id: req.params.id } });
  await audit(req.user!.id, 'payment.method', `${req.user!.name}: ${m.name} usulini o‘chirdi`);
  res.json({ ok: true });
}));

// --- Kartalar va yo‘riqnoma
adminPaymentsRouter.get('/cards', ah(async (_req, res) => {
  const cards = await prisma.paymentCard.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ items: cards.map((c) => ({ id: c.id, number: fmtCard(c.number), masked: maskCard(c.number), holder: c.holder, bank: c.bank, active: c.active, primary: c.primary })), instruction: await getInstruction() });
}));
const cardBody = z.object({ number: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length >= 16 && v.length <= 19, 'Karta raqami 16–19 raqam'), holder: z.string().trim().min(2).max(80), bank: z.string().trim().min(2).max(80) });
adminPaymentsRouter.post('/cards', ah(async (req, res) => {
  const b = parse(cardBody, req.body);
  const first = !(await prisma.paymentCard.count({ where: { active: true } }));
  const c = await prisma.paymentCard.create({ data: { ...b, primary: first } });
  await audit(req.user!.id, 'payment.card', `${req.user!.name}: karta qo‘shdi ${maskCard(c.number)}`);
  res.status(201).json({ id: c.id });
}));
adminPaymentsRouter.patch('/cards/:id', ah(async (req, res) => {
  const b = parse(cardBody.partial().extend({ active: z.boolean().optional(), primary: z.literal(true).optional() }), req.body);
  const prev = await prisma.paymentCard.findUnique({ where: { id: req.params.id } });
  if (!prev) throw notFound();
  if (b.primary && !(b.active ?? prev.active)) throw bad('Faolsiz kartani asosiy qilib bo‘lmaydi');
  await prisma.$transaction([
    ...(b.primary ? [prisma.paymentCard.updateMany({ data: { primary: false } })] : []),
    prisma.paymentCard.update({ where: { id: prev.id }, data: { ...b, ...(b.active === false ? { primary: false } : {}) } }),
  ]);
  await audit(req.user!.id, 'payment.card', `${req.user!.name}: ${maskCard(b.number ?? prev.number)} – ${b.primary ? 'asosiy karta qildi' : b.active === false ? 'faolsizlantirdi' : b.active ? 'faollashtirdi' : 'tahrirladi'}`);
  res.json({ ok: true });
}));
adminPaymentsRouter.delete('/cards/:id', ah(async (req, res) => {
  const c = await prisma.paymentCard.delete({ where: { id: req.params.id } });
  await audit(req.user!.id, 'payment.card', `${req.user!.name}: kartani o‘chirdi ${maskCard(c.number)}`);
  res.json({ ok: true });
}));
adminPaymentsRouter.put('/instruction', ah(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(5).max(2000) }), req.body);
  await setInstruction(text);
  await audit(req.user!.id, 'payment.instruction', `${req.user!.name}: to‘lov yo‘riqnomasini o‘zgartirdi`);
  res.json({ ok: true });
}));

// --- Bloklar va qarorlar jurnali
adminPaymentsRouter.get('/blocks', ah(async (_req, res) => {
  const bs = await prisma.paymentBlock.findMany({ where: { liftedAt: null, endsAt: { gt: new Date() } }, include: { user: { select: { ...miniSelect, phone: true } } }, orderBy: { endsAt: 'asc' } });
  res.json({ items: bs.map((b) => ({ id: b.id, user: b.user, reason: b.reason, startedAt: b.startedAt, endsAt: b.endsAt, startedT: fmtDT(b.startedAt), endsT: fmtDT(b.endsAt) })) });
}));
adminPaymentsRouter.post('/blocks/:id/lift', ah(async (req, res) => {
  await liftBlock(req.params.id, req.user!.id, req.user!.name);
  res.json({ ok: true });
}));
adminPaymentsRouter.get('/audit', ah(async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ where: { action: { startsWith: 'payment.' } }, orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { name: true } } } });
  res.json({ items: rows.map((a) => ({ id: a.id, at: a.createdAt, atT: fmtDT(a.createdAt), who: a.actor?.name ?? (a.action === 'payment.block' ? 'Tizim' : 'Telegram admin'), text: a.text.replace(/^[^:]{1,60}: /, '') })) });
}));

/** Foydalanuvchining to‘lov tarixi (admin) */
adminPaymentsRouter.get('/users/:id/history', ah(async (req, res) => {
  const [ps, blocks] = await Promise.all([
    prisma.payment.findMany({ where: { userId: req.params.id }, include: { team: { select: { name: true } }, method: { select: { code: true, name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.paymentBlock.findMany({ where: { userId: req.params.id }, orderBy: { startedAt: 'desc' } }),
  ]);
  res.json({ payments: ps.map(paymentOut), blocks });
}));
