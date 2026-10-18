import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

export type Tariff = { createPrice: number; monthlyPrice: number; memberLimit: number };

/** Obuna davri: 30 kun */
export const PERIOD_DAYS = 30;
/** Firibgarlikdan himoya: ketma-ket shuncha «Aldov» → blok */
export const FRAUD_LIMIT = 5;
export const BLOCK_HOURS = 24;

const DEFAULTS: Tariff = { createPrice: 150000, monthlyPrice: 50000, memberLimit: 15 };
const KEYS = { createPrice: 'team.createPrice', monthlyPrice: 'team.monthlyPrice', memberLimit: 'team.memberLimit' } as const;

export async function getTariff(): Promise<Tariff> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const v = (k: keyof Tariff) => {
    const r = rows.find((x) => x.key === KEYS[k]);
    return typeof r?.value === 'number' ? r.value : DEFAULTS[k];
  };
  return { createPrice: v('createPrice'), monthlyPrice: v('monthlyPrice'), memberLimit: v('memberLimit') };
}

export async function setTariff(t: Partial<Tariff>) {
  for (const [k, val] of Object.entries(t) as [keyof Tariff, number | undefined][]) {
    if (val == null) continue;
    await prisma.setting.upsert({ where: { key: KEYS[k] }, update: { value: val }, create: { key: KEYS[k], value: val } });
  }
  return getTariff();
}

export async function getInstruction(): Promise<string> {
  const r = await prisma.setting.findUnique({ where: { key: 'payment.instruction' } });
  return typeof r?.value === 'string' ? r.value : '';
}

export async function setInstruction(text: string) {
  const value = text as Prisma.InputJsonValue;
  await prisma.setting.upsert({ where: { key: 'payment.instruction' }, update: { value }, create: { key: 'payment.instruction', value } });
}

/** Jamoaning a’zolar limiti: jamoa uchun alohida belgilangan bo‘lsa – o‘sha, aks holda umumiy tarif */
export const limitOf = (team: { memberLimit: number | null }, t: Tariff) => team.memberLimit ?? t.memberLimit;
