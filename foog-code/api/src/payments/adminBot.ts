import type { Payment, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { redis } from '../redis';
import { tg, tgUpload } from '../telegram';
import { adminChatIds, isAdminChat } from '../admins';
import { audit } from '../notify';
import { HttpError } from '../http';
import { FRAUD_LIMIT, getInstruction, getTariff, setInstruction, setTariff } from './settings';
import { PURPOSE_T, decide, fmtDT, liftBlock, receiptFile, sum, type TeamDraft } from './service';
import { fmtCard, maskCard } from './providers';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtPhone = (p: string | null) => (p && /^\+998\d{9}$/.test(p) ? `+998 ${p.slice(4, 6)} ${p.slice(6, 9)} ${p.slice(9, 11)} ${p.slice(11)}` : p);
type BotMsg = { chatId: string; messageId: number };

const BUTTONS = (id: string) => ({ inline_keyboard: [[{ text: '⛔ Aldov', callback_data: `pay:fraud:${id}` }, { text: '✅ To‘g‘ri', callback_data: `pay:ok:${id}` }], [{ text: '📞 Telefon qilish', callback_data: `pay:call:${id}` }]] });

async function caption(p: Payment) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: p.userId } });
  const team = p.teamId ? (await prisma.team.findUnique({ where: { id: p.teamId } }))?.name : (p.teamDraft as TeamDraft | null)?.name;
  return [
    `💳 <b>Yangi to‘lov · ${p.code}</b>`,
    `👤 ${esc(u.name)} · ID ${u.telegramId ?? '—'}${u.username ? ` · @${esc(u.username)}` : ''}`,
    `📞 ${fmtPhone(u.phone) ?? 'raqam yo‘q'}`,
    `⚽ ${esc(team ?? '—')}`,
    `🧾 ${PURPOSE_T[p.purpose]} · ${sum(p.amount)}`,
    `🕒 ${fmtDT(p.submittedAt ?? p.createdAt)}`,
    ...(u.fraudStreak ? [`⚠️ Ketma-ket aldov: ${u.fraudStreak} / ${FRAUD_LIMIT}`] : []),
  ].join('\n');
}

/** Chek kelganda: har bir adminga rasm + uchta tugma */
export async function sendPaymentToAdmins(p: Payment, onlyChat?: string) {
  const ids = onlyChat ? [onlyChat] : await adminChatIds();
  if (!ids.length) { console.warn('[payments] adminlar chati sozlanmagan: TELEGRAM_ADMIN_CHAT_IDS'); return; }
  const text = await caption(p);
  const file = receiptFile(p);
  const sent: BotMsg[] = [];
  for (const chatId of ids) {
    const fields = { chat_id: chatId, caption: text, parse_mode: 'HTML', reply_markup: BUTTONS(p.id) };
    const r = (file ? await tgUpload('sendPhoto', fields, 'photo', file, `${p.code}.jpg`) : await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: BUTTONS(p.id) })) as { message_id: number } | null;
    if (r?.message_id) sent.push({ chatId, messageId: r.message_id });
  }
  const prev = (p.botMessages as BotMsg[] | null) ?? [];
  await prisma.payment.update({ where: { id: p.id }, data: { botMessages: [...prev, ...sent] as unknown as Prisma.InputJsonValue } });
}

/** Qaror qabul qilingach: barcha adminlardagi xabarda tugmalarni yopamiz va natijani yozamiz */
export async function closePaymentMessages(paymentId: string, line: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) return;
  const text = `${await caption(p)}\n\n${line}`;
  for (const m of (p.botMessages as BotMsg[] | null) ?? []) {
    const r = await tg('editMessageCaption', { chat_id: m.chatId, message_id: m.messageId, caption: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } });
    if (!r) await tg('editMessageText', { chat_id: m.chatId, message_id: m.messageId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } });
  }
}
export const decisionLine = (status: string, by: string, at: Date | null) => `${status === 'approved' ? '✅ To‘g‘ri' : '⛔ Aldov'} · ${esc(by)} · ${at ? fmtDT(at) : ''}`;

/** Sayt yoki bot – qaror bitta funksiya orqali, keyin bot xabarlari yangilanadi */
export async function decideAndSync(paymentId: string, decision: 'approve' | 'fraud', actor: { userId: string | null; name: string; via: 'web' | 'bot' }) {
  const r = await decide(paymentId, decision, actor);
  await closePaymentMessages(paymentId, decisionLine(r.payment.status, actor.name, r.payment.decidedAt) + (r.blocked ? `\n🚫 Foydalanuvchi 24 soatga bloklandi` : ''));
  return r;
}

// ---------- Admin buyruqlari ----------
type State = { step: 'addcard' | 'setcard' | 'instruction'; cardId?: string };
const stKey = (chat: number) => `botadm:${chat}`;
const setState = (chat: number, s: State) => redis.set(stKey(chat), JSON.stringify(s), 'EX', 600);
const send = (chat: number | string, text: string, extra: Record<string, unknown> = {}) => tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

const HELP = [
  '<b>FOOG admin · to‘lovlar</b>',
  '/payments – tekshiruvdagi to‘lovlar',
  '/cards – kartalar (asosiy, faolsizlantirish, o‘chirish)',
  '/addcard – yangi karta qo‘shish',
  '/setcard – karta raqamini o‘zgartirish',
  '/instruction – to‘lov yo‘riqnomasini tahrirlash',
  '/methods – to‘lov usullari (faol / xabar / o‘chiq)',
  '/tariff – narx va limit',
  '/setprice create 150000 · /setprice monthly 50000 · /setlimit 15',
  '/unblock – bloklangan hisoblar',
].join('\n');

async function cardsView() {
  const cards = await prisma.paymentCard.findMany({ orderBy: { createdAt: 'asc' } });
  if (!cards.length) return { text: 'Karta yo‘q. /addcard bilan qo‘shing.', markup: { inline_keyboard: [] } };
  const text = ['<b>Kartalar</b> (⭐ – foydalanuvchiga ko‘rsatiladi)', ...cards.map((c, i) => `${i + 1}. ${c.primary && c.active ? '⭐ ' : ''}${maskCard(c.number)} · ${esc(c.bank)} · ${esc(c.holder)}${c.active ? '' : ' · <i>faolsiz</i>'}`)].join('\n');
  const markup = { inline_keyboard: cards.map((c, i) => [
    { text: `${i + 1}. ⭐`, callback_data: `card:primary:${c.id}` },
    { text: c.active ? '⏸' : '▶️', callback_data: `card:toggle:${c.id}` },
    { text: '✏️', callback_data: `card:edit:${c.id}` },
    { text: '🗑', callback_data: `card:del:${c.id}` },
  ]) };
  return { text, markup };
}

const MST: Record<string, string> = { on: '🟢 Faol', msg: '🟡 Xizmat xabari', off: '⚪️ O‘chiq' };
async function methodsView() {
  const ms = await prisma.paymentMethod.findMany({ orderBy: { sort: 'asc' } });
  return {
    text: ['<b>To‘lov usullari</b>', ...ms.map((m) => `${esc(m.name)} – ${MST[m.status]}`), '', '<i>«Xizmat xabari»: tugma ko‘rinadi, bosilganda «Server vaqtincha ishlamayapti…» chiqadi.</i>'].join('\n'),
    markup: { inline_keyboard: ms.map((m) => (['on', 'msg', 'off'] as const).filter((s) => !(m.provider === 'card' && s === 'msg')).map((s) => ({ text: `${m.status === s ? '• ' : ''}${m.name}: ${MST[s].split(' ').slice(1).join(' ')}`, callback_data: `m:${m.code}:${s}` }))) },
  };
}

async function blocksView() {
  const bs = await prisma.paymentBlock.findMany({ where: { liftedAt: null, endsAt: { gt: new Date() } }, include: { user: true }, orderBy: { endsAt: 'asc' } });
  if (!bs.length) return { text: 'Bloklangan hisob yo‘q.', markup: { inline_keyboard: [] } };
  return {
    text: ['<b>Bloklangan hisoblar</b>', ...bs.map((b) => `• ${esc(b.user.name)}${b.user.phone ? ` · ${fmtPhone(b.user.phone)}` : ''} – ${fmtDT(b.endsAt)} gacha`)].join('\n'),
    markup: { inline_keyboard: bs.map((b) => [{ text: `Blokdan chiqarish: ${b.user.name}`, callback_data: `blk:lift:${b.id}` }]) },
  };
}

function parseCard(text: string) {
  const [num, holder, ...bank] = text.split(';').map((x) => x.trim());
  const digits = (num ?? '').replace(/\D/g, '');
  if (digits.length < 16 || digits.length > 19) return null;
  return { number: digits, holder: holder || 'FOOG', bank: bank.join('; ') || 'Bank kartasi' };
}

/** Admin xabari (buyruq yoki kutilgan javob). true – xabar qayta ishlandi */
export async function handleAdminMessage(chatId: number, text: string): Promise<boolean> {
  const adm = await isAdminChat(chatId);
  if (!adm.ok) return false;
  const who = adm.name ?? 'Admin';
  const [cmd, ...args] = text.trim().split(/\s+/);
  const raw = await redis.get(stKey(chatId));
  if (!cmd.startsWith('/') && raw) {
    const st = JSON.parse(raw) as State;
    await redis.del(stKey(chatId));
    if (st.step === 'instruction') {
      await setInstruction(text.trim());
      await audit(adm.userId, 'payment.instruction', `${who}: to‘lov yo‘riqnomasini o‘zgartirdi (bot)`);
      await send(chatId, '✅ Yo‘riqnoma saqlandi. Foydalanuvchilar «To‘lov qilish» oynasida yangisini ko‘radi.');
      return true;
    }
    if (st.step === 'addcard') {
      const c = parseCard(text);
      if (!c) { await send(chatId, 'Karta raqami noto‘g‘ri (16–19 raqam). Qaytadan /addcard'); return true; }
      const first = !(await prisma.paymentCard.count({ where: { active: true } }));
      const card = await prisma.paymentCard.create({ data: { ...c, primary: first } });
      await audit(adm.userId, 'payment.card', `${who}: karta qo‘shdi ${maskCard(card.number)} (bot)`);
      await send(chatId, `✅ Karta qo‘shildi: ${fmtCard(card.number)}${first ? ' · foydalanuvchilarga ko‘rsatiladi' : ''}\n/cards – ro‘yxat`);
      return true;
    }
    if (st.step === 'setcard' && st.cardId) {
      const digits = text.replace(/\D/g, '');
      if (digits.length < 16 || digits.length > 19) { await send(chatId, 'Karta raqami noto‘g‘ri (16–19 raqam). Qaytadan /setcard'); return true; }
      const card = await prisma.paymentCard.update({ where: { id: st.cardId }, data: { number: digits } });
      await audit(adm.userId, 'payment.card', `${who}: karta raqamini o‘zgartirdi → ${maskCard(card.number)} (bot)`);
      await send(chatId, `✅ Karta raqami yangilandi: ${fmtCard(card.number)}`);
      return true;
    }
  }
  switch (cmd.split('@')[0]) {
    case '/admin': case '/help': await send(chatId, HELP); return true;
    case '/payments': {
      const ps = await prisma.payment.findMany({ where: { status: 'review' }, orderBy: { submittedAt: 'asc' }, take: 10 });
      if (!ps.length) { await send(chatId, 'Tekshiruvdagi to‘lov yo‘q ✅'); return true; }
      await send(chatId, `Tekshiruvda: ${ps.length} ta`);
      for (const p of ps) await sendPaymentToAdmins(p, String(chatId));
      return true;
    }
    case '/cards': { const v = await cardsView(); await send(chatId, v.text, { reply_markup: v.markup }); return true; }
    case '/addcard':
      await setState(chatId, { step: 'addcard' });
      await send(chatId, 'Yangi karta: <code>raqam; egasi; bank</code>\nMasalan: <code>8600 1234 5678 4417; FOOG MCHJ · A. Karimov; Uzcard · Kapitalbank</code>');
      return true;
    case '/setcard': {
      const cards = await prisma.paymentCard.findMany({ orderBy: { createdAt: 'asc' } });
      if (!cards.length) { await send(chatId, 'Karta yo‘q. /addcard'); return true; }
      await send(chatId, 'Qaysi kartaning raqamini o‘zgartiramiz?', { reply_markup: { inline_keyboard: cards.map((c) => [{ text: `${maskCard(c.number)} · ${c.bank}`, callback_data: `card:edit:${c.id}` }]) } });
      return true;
    }
    case '/instruction':
      await setState(chatId, { step: 'instruction' });
      await send(chatId, `<b>Hozirgi yo‘riqnoma:</b>\n${esc(await getInstruction()) || '—'}\n\nYangi matnni yuboring (bekor qilish: /cancel).`);
      return true;
    case '/cancel': await redis.del(stKey(chatId)); await send(chatId, 'Bekor qilindi.'); return true;
    case '/methods': { const v = await methodsView(); await send(chatId, v.text, { reply_markup: v.markup }); return true; }
    case '/tariff': {
      const t = await getTariff();
      await send(chatId, `<b>Jamoa tarifi</b>\nJamoa yaratish: ${sum(t.createPrice)} (birinchi oy kiradi)\nOylik obuna: ${sum(t.monthlyPrice)}\nA’zolar limiti: ${t.memberLimit} kishi\n\n/setprice create 150000\n/setprice monthly 50000\n/setlimit 15`);
      return true;
    }
    case '/setprice': case '/setlimit': {
      const n = Number((cmd.startsWith('/setlimit') ? args[0] : args[1])?.replace(/\D/g, ''));
      const kind = cmd.startsWith('/setlimit') ? 'limit' : args[0];
      if (!Number.isFinite(n) || (kind === 'limit' ? n < 2 || n > 100 : n < 0 || n > 100_000_000) || !['create', 'monthly', 'limit'].includes(kind)) { await send(chatId, 'Format: /setprice create 150000 · /setprice monthly 50000 · /setlimit 15'); return true; }
      const t = await setTariff(kind === 'create' ? { createPrice: n } : kind === 'monthly' ? { monthlyPrice: n } : { memberLimit: n });
      await audit(adm.userId, 'payment.tariff', `${who}: tarifni o‘zgartirdi (bot): ${sum(t.createPrice)} / ${sum(t.monthlyPrice)} oyiga / ${t.memberLimit} kishi`);
      await send(chatId, `✅ Saqlandi: ${sum(t.createPrice)} · ${sum(t.monthlyPrice)} oyiga · ${t.memberLimit} kishi`);
      return true;
    }
    case '/unblock': { const v = await blocksView(); await send(chatId, v.text, { reply_markup: v.markup }); return true; }
  }
  return false;
}

type Cbq = { id: string; from: { id: number; first_name?: string }; message?: { chat: { id: number }; message_id: number }; data?: string };

/** Inline tugmalar */
export async function handleCallback(q: Cbq) {
  const answer = (text?: string, alert = false) => tg('answerCallbackQuery', { callback_query_id: q.id, text, show_alert: alert });
  const adm = await isAdminChat(q.from.id);
  if (!adm.ok) return answer('Bu amal faqat FOOG adminlari uchun', true);
  const who = adm.name ?? q.from.first_name ?? 'Admin';
  const [kind, action, id] = (q.data ?? '').split(':');
  const chat = q.message?.chat.id, mid = q.message?.message_id;
  const refresh = async (v: { text: string; markup: unknown }) => chat && mid && tg('editMessageText', { chat_id: chat, message_id: mid, text: v.text, parse_mode: 'HTML', reply_markup: v.markup });
  try {
    if (kind === 'pay') {
      if (action === 'call') {
        const p = await prisma.payment.findUnique({ where: { id }, include: { user: true } });
        const ph = fmtPhone(p?.user.phone ?? null);
        await answer(ph ? `${p!.user.name}: ${ph}` : 'Foydalanuvchi telefon raqamini ulashmagan. Telegram orqali yozing.', true);
        if (ph && chat) await send(chat, `📞 ${esc(p!.user.name)}: ${ph}${p!.user.username ? `\n✈️ @${esc(p!.user.username)}` : ''}`);
        return;
      }
      const r = await decideAndSync(id, action === 'ok' ? 'approve' : 'fraud', { userId: adm.userId, name: who, via: 'bot' });
      return answer(r.payment.status === 'approved' ? `✅ ${r.payment.code} tasdiqlandi` : r.blocked ? '⛔ Aldov · foydalanuvchi 24 soatga bloklandi' : `⛔ ${r.payment.code} aldov deb belgilandi`);
    }
    if (kind === 'card') {
      if (action === 'edit') { await setState(q.from.id, { step: 'setcard', cardId: id }); await answer(); if (chat) await send(chat, 'Yangi karta raqamini yuboring (16–19 raqam). Bekor qilish: /cancel'); return; }
      if (action === 'del') { await answer(); if (chat) await send(chat, 'Kartani ro‘yxatdan butunlay olib tashlaymizmi?', { reply_markup: { inline_keyboard: [[{ text: '🗑 Ha, o‘chirish', callback_data: `card:delok:${id}` }]] } }); return; }
      const card = await prisma.paymentCard.findUnique({ where: { id } });
      if (!card) return answer('Karta topilmadi', true);
      if (action === 'delok') { await prisma.paymentCard.delete({ where: { id } }); await audit(adm.userId, 'payment.card', `${who}: kartani o‘chirdi ${maskCard(card.number)} (bot)`); if (chat && mid) await tg('editMessageText', { chat_id: chat, message_id: mid, text: `🗑 ${maskCard(card.number)} o‘chirildi` }); return answer('O‘chirildi'); }
      if (action === 'toggle') await prisma.paymentCard.update({ where: { id }, data: { active: !card.active, ...(card.active ? { primary: false } : {}) } });
      if (action === 'primary') {
        if (!card.active) return answer('Avval kartani faollashtiring', true);
        await prisma.$transaction([prisma.paymentCard.updateMany({ data: { primary: false } }), prisma.paymentCard.update({ where: { id }, data: { primary: true } })]);
      }
      await audit(adm.userId, 'payment.card', `${who}: ${maskCard(card.number)} – ${action === 'toggle' ? (card.active ? 'faolsizlantirdi' : 'faollashtirdi') : 'asosiy karta qildi'} (bot)`);
      await refresh(await cardsView());
      return answer('Saqlandi');
    }
    if (kind === 'm') {
      const m = await prisma.paymentMethod.update({ where: { code: action }, data: { status: id as 'on' | 'msg' | 'off' } });
      await audit(adm.userId, 'payment.method', `${who}: ${m.name} → ${MST[m.status]} (bot)`);
      await refresh(await methodsView());
      return answer('Saqlandi');
    }
    if (kind === 'blk' && action === 'lift') {
      await liftBlock(id, adm.userId, who);
      await refresh(await blocksView());
      return answer('Blokdan chiqarildi');
    }
    return answer();
  } catch (e) {
    return answer(e instanceof HttpError ? e.message : 'Xatolik yuz berdi', true);
  }
}
