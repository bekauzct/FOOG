import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import type { Payment, Prisma, Team } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError, bad, conflict, forbidden, notFound } from '../http';
import { audit, notify } from '../notify';
import { TZ } from '../time';
import { BLOCK_HOURS, FRAUD_LIMIT, PERIOD_DAYS, getTariff, limitOf } from './settings';
import { providerOf, type Checkout } from './providers';

// ---------- Chek skrinshotlari: ochiq /uploads papkasidan tashqarida ----------
export const RECEIPT_DIR = path.resolve(env.uploadDir, '..', 'private', 'receipts');
fs.mkdirSync(RECEIPT_DIR, { recursive: true });
export const receiptUpload = multer({
  storage: multer.diskStorage({ destination: RECEIPT_DIR, filename: (_r, f, cb) => cb(null, crypto.randomUUID() + (f.mimetype === 'image/png' ? '.png' : f.mimetype === 'image/webp' ? '.webp' : '.jpg')) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => (['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype) ? cb(null, true) : cb(bad('Chek rasm bo‘lishi kerak: JPG yoki PNG, 5 MB gacha'))),
});
export const receiptFile = (p: { receiptPath: string | null }) => (p.receiptPath ? path.join(RECEIPT_DIR, path.basename(p.receiptPath)) : null);

// ---------- Formatlash ----------
export const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`;
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
export function fmtDT(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${MONTHS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`;
}
export function fmtDate(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'numeric' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${MONTHS[Number(p.month) - 1]}`;
}
export const PURPOSE_T = { team_create: 'Jamoa yaratish', team_monthly: 'Oylik to‘lov' } as const;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);

// ---------- Bloklar ----------
export async function activeBlock(userId: string) {
  return prisma.paymentBlock.findFirst({ where: { userId, liftedAt: null, endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
}
export async function assertCanPay(userId: string) {
  const b = await activeBlock(userId);
  if (b) throw new HttpError(403, `Hisobingiz ${fmtDT(b.endsAt)} gacha cheklangan: ketma-ket ${FRAUD_LIMIT} ta to‘lov cheki tasdiqlanmadi. Xato deb hisoblasangiz: @foog_pro`, 'payment_blocked');
}

// ---------- Jamoa ----------
export type TeamDraft = { name: string; short?: string; district?: string; level?: string; lookingFor?: string[]; plays?: string };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || name.slice(0, 2).toUpperCase();

export async function createTeamRecord(captainId: string, d: TeamDraft, paidUntil: Date | null) {
  const short = (d.short?.trim() || initials(d.name)).toUpperCase().slice(0, 4);
  return prisma.team.create({
    data: {
      name: d.name.trim(), short, district: d.district, level: d.level ?? 'intermediate', lookingFor: d.lookingFor ?? [], plays: d.plays,
      captainId, paidUntil, status: 'active',
      members: { create: { userId: captainId } }, chats: { create: { type: 'team', name: d.name.trim(), members: { create: { userId: captainId } } } },
    },
    include: { chats: true },
  });
}

/** Kapitan bitta jamoa boshqaradi */
export const captainTeam = (userId: string) => prisma.team.findFirst({ where: { captainId: userId }, orderBy: { createdAt: 'desc' } });

/** Jamoa faol va limitga yetmaganmi – qo‘shilish va taklif uchun */
export async function assertTeamOpen(team: Team, extra = 1) {
  if (team.status === 'frozen') throw forbidden('Jamoa muzlatilgan: oylik obuna to‘lanmagan. Kapitan to‘lovni amalga oshirgach, qo‘shilish ochiladi.');
  const t = await getTariff();
  const n = await prisma.teamMember.count({ where: { teamId: team.id } });
  if (n + extra > limitOf(team, t)) throw conflict(`Jamoada joy qolmagan: ${n} / ${limitOf(team, t)}. Limitni FOOG admini belgilaydi.`, 'team_full');
}

// ---------- To‘lov boshlash ----------
async function nextCode() {
  const [r] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('payment_code_seq') AS n`;
  return `PAY-${r.n}`;
}

export async function startPayment(user: { id: string; role: string }, input: { purpose: 'team_create' | 'team_monthly'; method: string; team?: TeamDraft; teamId?: string }): Promise<{ payment: Payment; checkout: Checkout }> {
  if (user.role !== 'player') throw forbidden('Jamoa faqat futbolchilar uchun');
  await assertCanPay(user.id);
  const method = await prisma.paymentMethod.findUnique({ where: { code: input.method } });
  if (!method || method.status === 'off') throw notFound('Bu to‘lov usuli mavjud emas');
  const t = await getTariff();
  let teamId: string | null = null, amount: number, draft: TeamDraft | undefined;
  if (input.purpose === 'team_create') {
    if (!input.team?.name || input.team.name.trim().length < 2) throw bad('Jamoa nomini kiriting');
    if (await captainTeam(user.id)) throw conflict('Sizda allaqachon jamoa bor – bitta kapitan bitta jamoani boshqaradi');
    amount = t.createPrice; draft = { ...input.team, name: input.team.name.trim() };
  } else {
    const team = input.teamId ? await prisma.team.findUnique({ where: { id: input.teamId } }) : await captainTeam(user.id);
    if (!team) throw notFound('Jamoa topilmadi');
    if (team.captainId !== user.id) throw forbidden('Oylik to‘lovni jamoa kapitani qiladi');
    amount = t.monthlyPrice; teamId = team.id;
  }
  // Tekshiruvdagi to‘lov bo‘lsa – yangisini ochmaymiz; chek yuborilmagan eski so‘rovni qayta ishlatamiz
  const open = await prisma.payment.findFirst({ where: { userId: user.id, purpose: input.purpose, status: { in: ['awaiting', 'review'] }, ...(teamId ? { teamId } : {}) }, orderBy: { createdAt: 'desc' } });
  if (open?.status === 'review') throw conflict(`To‘lovingiz tekshirilmoqda · ${open.code}. Natija Telegram’ga keladi.`, 'payment_in_review');
  const data = { amount, methodId: method.id, teamDraft: (draft ?? undefined) as Prisma.InputJsonValue | undefined };
  const payment = open ? await prisma.payment.update({ where: { id: open.id }, data }) : await prisma.payment.create({ data: { ...data, code: await nextCode(), userId: user.id, teamId, purpose: input.purpose } });
  const checkout = await providerOf(method.provider).start(payment);
  return { payment, checkout };
}

// ---------- Chek yuborish ----------
export async function submitReceipt(paymentId: string, userId: string, file: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.userId !== userId) throw notFound('To‘lov topilmadi');
  if (p.status !== 'awaiting') { fs.rm(path.join(RECEIPT_DIR, file), () => undefined); throw conflict('Bu to‘lov uchun chek allaqachon yuborilgan'); }
  await assertCanPay(userId);
  const r = await prisma.payment.updateMany({ where: { id: p.id, status: 'awaiting' }, data: { status: 'review', receiptPath: file, submittedAt: new Date() } });
  if (!r.count) throw conflict('Bu to‘lov uchun chek allaqachon yuborilgan');
  return prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
}

// ---------- Admin qarori ----------
export type Actor = { userId: string | null; name: string; via: 'web' | 'bot' };

export async function decide(paymentId: string, decision: 'approve' | 'fraud', actor: Actor) {
  const now = new Date();
  // Bitta so‘rov ikki marta hal qilinmaydi: faqat «review» holatidagisi o‘zgaradi
  const r = await prisma.payment.updateMany({ where: { id: paymentId, status: 'review' }, data: { status: decision === 'approve' ? 'approved' : 'fraud', decidedAt: now, decidedById: actor.userId, decidedVia: actor.via } });
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { user: true, team: true } });
  if (!p) throw notFound('To‘lov topilmadi');
  if (!r.count) throw conflict(p.status === 'approved' || p.status === 'fraud' ? `Bu so‘rov bo‘yicha qaror qabul qilingan: ${p.status === 'approved' ? 'tasdiqlangan' : 'aldov'}${p.decidedAt ? ` · ${fmtDT(p.decidedAt)}` : ''}` : 'So‘rov hali tekshiruvga yuborilmagan', 'already_decided');

  let blocked = false;
  let teamName = p.team?.name ?? (p.teamDraft as TeamDraft | null)?.name ?? '';
  if (decision === 'approve') {
    await prisma.user.update({ where: { id: p.userId }, data: { fraudStreak: 0 } });
    const t = await getTariff();
    if (p.purpose === 'team_create') {
      const exists = await captainTeam(p.userId);
      const team = exists ?? await createTeamRecord(p.userId, p.teamDraft as TeamDraft, t.monthlyPrice > 0 ? addDays(now, PERIOD_DAYS) : null);
      teamName = team.name;
      await prisma.payment.update({ where: { id: p.id }, data: { teamId: team.id } });
      await notify(p.userId, { type: 'system', kind: 'payment_ok', title: `To‘lov tasdiqlandi · «${team.name}» jamoasi faollashdi`, body: `${p.code} · ${sum(p.amount)}`, refType: 'team', refId: team.id, telegram: `✅ To‘lov tasdiqlandi (${p.code}). «${team.name}» jamoasi faollashdi. Jamoangizni saytda boshqaring: https://foog.uz/team` });
    } else if (p.team) {
      const from = p.team.paidUntil && p.team.paidUntil > now ? p.team.paidUntil : now;
      const until = addDays(from, PERIOD_DAYS);
      await prisma.team.update({ where: { id: p.team.id }, data: { paidUntil: until, status: 'active' } });
      await notify(p.userId, { type: 'system', kind: 'payment_ok', title: `To‘lov tasdiqlandi · obuna ${fmtDate(until)} gacha`, body: `${p.code} · ${p.team.name}`, refType: 'team', refId: p.team.id, telegram: `✅ To‘lov tasdiqlandi (${p.code}). «${p.team.name}» obunasi ${fmtDate(until)} gacha uzaytirildi.` });
    }
    await audit(actor.userId, 'payment.approve', `${actor.name}: ${p.code} ni tasdiqladi · ${p.purpose === 'team_create' ? `${teamName} jamoasi yaratildi` : `${teamName} obunasi ${PERIOD_DAYS} kunga uzaytirildi`}`, 'payment', p.id);
  } else {
    const u = await prisma.user.update({ where: { id: p.userId }, data: { fraudStreak: { increment: 1 } } });
    await audit(actor.userId, 'payment.fraud', `${actor.name}: ${p.code} ni aldov deb belgiladi`, 'payment', p.id);
    if (u.fraudStreak >= FRAUD_LIMIT) {
      const endsAt = new Date(now.getTime() + BLOCK_HOURS * 36e5);
      await prisma.paymentBlock.create({ data: { userId: u.id, startedAt: now, endsAt, reason: `${FRAUD_LIMIT} ta ketma-ket aldov` } });
      await prisma.user.update({ where: { id: u.id }, data: { fraudStreak: 0 } });
      await audit(null, 'payment.block', `Tizim: ${u.name} ${BLOCK_HOURS} soatga bloklandi (${FRAUD_LIMIT} ta ketma-ket aldov) · ${fmtDT(now)} → ${fmtDT(endsAt)}`, 'user', u.id);
      blocked = true;
    }
    await notify(p.userId, { type: 'system', kind: 'payment_fraud', title: `To‘lov tasdiqlanmadi · ${p.code}`, body: blocked ? `Hisobingiz ${BLOCK_HOURS} soatga cheklandi` : 'Chek yoki ma’lumotlar shubhali deb topildi', telegram: `⛔ ${p.code} to‘lovi tasdiqlanmadi: chek yoki ma’lumotlar shubhali.${blocked ? ` Ketma-ket ${FRAUD_LIMIT} ta rad etilgani uchun hisobingiz ${BLOCK_HOURS} soatga cheklandi.` : ''} Savol bo‘lsa: @foog_pro` });
  }
  return { payment: await prisma.payment.findUniqueOrThrow({ where: { id: p.id } }), blocked, teamName };
}

export async function liftBlock(blockId: string, adminId: string | null, adminName: string) {
  const b = await prisma.paymentBlock.findUnique({ where: { id: blockId }, include: { user: true } });
  if (!b) throw notFound('Blok topilmadi');
  if (b.liftedAt || b.endsAt <= new Date()) throw conflict('Blok allaqachon tugagan');
  await prisma.paymentBlock.update({ where: { id: b.id }, data: { liftedAt: new Date(), liftedById: adminId } });
  await prisma.user.update({ where: { id: b.userId }, data: { fraudStreak: 0 } });
  await audit(adminId, 'payment.unblock', `${adminName}: ${b.user.name} ni qo‘lda blokdan chiqardi`, 'user', b.userId);
  await notify(b.userId, { type: 'system', kind: 'payment_unblock', title: 'To‘lov bloki olib tashlandi', telegram: '✅ FOOG: hisobingizdagi to‘lov cheklovi olib tashlandi.' });
  return b;
}

// ---------- Fon vazifasi: muddati o‘tgan jamoalarni muzlatish ----------
export async function freezeExpired() {
  const due = await prisma.team.findMany({ where: { status: 'active', paidUntil: { lt: new Date() } }, select: { id: true, name: true, captainId: true, paidUntil: true } });
  for (const t of due) {
    const r = await prisma.team.updateMany({ where: { id: t.id, status: 'active' }, data: { status: 'frozen' } });
    if (!r.count) continue;
    await notify(t.captainId, { type: 'system', kind: 'team_frozen', title: `«${t.name}» obunasi tugadi – jamoa muzlatildi`, body: 'Tarkib va tarix saqlanadi. Oylik to‘lovni qilib, jamoani tiklang.', refType: 'team', refId: t.id, telegram: `❄️ «${t.name}» obunasi tugadi. Jamoa muzlatildi: yangi a’zo, jamoa chati va o‘yinga jamoa bo‘lib yozilish yopiq. Tiklash: https://foog.uz/team` });
  }
  return due.length;
}

// ---------- Javob shakli ----------
export function paymentOut(p: Payment & { team?: { name: string } | null; method?: { code: string; name: string } | null }) {
  return {
    id: p.id, code: p.code, purpose: p.purpose, purposeT: PURPOSE_T[p.purpose], amount: p.amount, status: p.status,
    team: p.team?.name ?? (p.teamDraft as TeamDraft | null)?.name ?? null, method: p.method ? { code: p.method.code, name: p.method.name } : null,
    createdAt: p.createdAt, submittedAt: p.submittedAt, decidedAt: p.decidedAt, hasReceipt: !!p.receiptPath,
  };
}
