import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PartnerSardor from '@/components/PartnerSardor';

// Vaqtinchalik hamkorlik sahifasi: 7 kun ochiq, keyin o‘zi 404 bo‘ladi
const PARTNER_UNTIL = new Date('2026-11-03T23:59:59+05:00');
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'FOOG × Sardorshtein – hamkorlik taklifi',
  description: 'Futbol auditoriyangiz uchun foydali platforma. Siz orqali kelgan har bir mijozdan 50%.',
  openGraph: { title: 'FOOG × Sardorshtein – hamkorlik taklifi', description: 'Futbol auditoriyangiz uchun foydali platforma. Siz orqali kelgan har bir mijozdan 50%.' },
  robots: { index: false, follow: false },
};

export default function Page() {
  if (Date.now() > PARTNER_UNTIL.getTime()) notFound();
  return <PartnerSardor />;
}
