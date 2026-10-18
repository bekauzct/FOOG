import type { Payment, PaymentCard } from '@prisma/client';
import { prisma } from '../db';
import { HttpError } from '../http';
import { getInstruction } from './settings';

/**
 * To‘lov provayderlari – har biri alohida modul.
 * Yangi usul (masalan, Uzum API) qo‘shish: shu interfeysni bajaradigan obyekt yozib, PROVIDERS ga qo‘shish kifoya –
 * to‘lov oqimi, admin paneli va bot o‘zgarmaydi. Admin esa saytda shu provayder bilan yangi usul yaratadi.
 */
export type Checkout =
  | { kind: 'manual'; card: { bank: string; holder: string; number: string; masked: string }; instruction: string }
  | { kind: 'redirect'; url: string };

export interface PaymentProvider {
  key: string;
  label: string;
  /** manual – karta + chek + admin tekshiruvi; gateway – tashqi to‘lov tizimi */
  kind: 'manual' | 'gateway';
  start(payment: Payment): Promise<Checkout>;
}

export const SERVICE_DOWN = 'Server vaqtincha ishlamayapti. Iltimos, birozdan keyin qayta urinib ko‘ring yoki admin orqali karta yordamida to‘lov qiling.';
export const serviceDown = () => new HttpError(503, SERVICE_DOWN, 'payment_unavailable');

export const fmtCard = (n: string) => n.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
export const maskCard = (n: string) => { const d = n.replace(/\D/g, ''); return `${d.slice(0, 4)} •••• •••• ${d.slice(-4)}`; };

/** Foydalanuvchiga ko‘rsatiladigan karta: «asosiy» deb belgilangan faol karta, bo‘lmasa birinchi faol karta */
export async function activeCard(): Promise<PaymentCard | null> {
  return (await prisma.paymentCard.findFirst({ where: { active: true, primary: true } })) ?? prisma.paymentCard.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } });
}

const manualCard: PaymentProvider = {
  key: 'card', label: 'Bank kartasi (qo‘lda)', kind: 'manual',
  async start(p) {
    const card = await activeCard();
    if (!card) throw new HttpError(503, 'Hozir to‘lov uchun faol karta yo‘q. Admin bilan bog‘laning: @foog_pro', 'no_card');
    await prisma.payment.update({ where: { id: p.id }, data: { cardId: card.id } });
    return { kind: 'manual', card: { bank: card.bank, holder: card.holder, number: fmtCard(card.number), masked: maskCard(card.number) }, instruction: await getInstruction() };
  },
};

/** Avtomatik to‘lov tizimlari: rasmiy API ulanmaguncha «server vaqtincha ishlamayapti» xabari */
const gateway = (key: string, label: string): PaymentProvider => ({
  key, label, kind: 'gateway',
  async start() { throw serviceDown(); },
});

export const PROVIDERS: Record<string, PaymentProvider> = {
  card: manualCard,
  click: gateway('click', 'Click'),
  payme: gateway('payme', 'Payme'),
  uzum: gateway('uzum', 'Uzum'),
  payeer: gateway('payeer', 'Payeer'),
  gateway: gateway('gateway', 'Boshqa to‘lov tizimi (API keyin ulanadi)'),
};

export const providerOf = (key: string) => PROVIDERS[key] ?? PROVIDERS.gateway;
