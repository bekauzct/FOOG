import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Toshkentdagi futbol maydonlari – bo‘sh soatlar va bron',
  description: 'Toshkentdagi mini futbol va katta maydonlar: xaritada, narxlari, bo‘sh soatlari va sharhlari bilan. Onlayn bron qiling – to‘lov stadionda.',
  alternates: { canonical: '/stadiums' },
};

export default function StadiumsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
