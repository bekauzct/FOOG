import type { Metadata } from 'next';

const API = process.env.API_URL || 'http://localhost:4000';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://foog.uz';

type S = { id: string; name: string; address: string; district: string; description: string | null; lat: number; lng: number; phone: string | null; photos: { url: string }[]; pitches: { price: number; size: string }[]; rating: { avg: number | null; count: number } };

async function load(id: string): Promise<S | null> {
  try {
    const r = await fetch(`${API}/api/v1/stadiums/${id}`, { next: { revalidate: 3600 } });
    return r.ok ? ((await r.json()) as S) : null;
  } catch { return null; }
}
const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`;
const abs = (u: string) => (u.startsWith('http') ? u : `${SITE}${u}`);

// Har bir stadion sahifasi uchun o‘z sarlavhasi, tavsifi va rasmi (Google va Telegram ko‘rinishi)
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await load(params.id);
  if (!s) return { title: 'Stadion', robots: { index: false } };
  const min = s.pitches.length ? Math.min(...s.pitches.map((p) => p.price)) : null;
  const title = `${s.name} – futbol maydoni, ${s.district}`;
  const description = `${s.name}, ${s.address}. ${min ? `Soatiga ${sum(min)}dan. ` : ''}Bo‘sh soatlarni ko‘ring va onlayn bron qiling – to‘lov stadionda.`;
  const images = s.photos.slice(0, 1).map((p) => abs(p.url));
  return {
    title, description,
    alternates: { canonical: `/stadiums/${s.id}` },
    openGraph: { type: 'website', url: `${SITE}/stadiums/${s.id}`, title, description, images, siteName: 'FOOG', locale: 'uz_UZ' },
  };
}

export default async function StadiumLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const s = await load(params.id);
  const min = s?.pitches.length ? Math.min(...s.pitches.map((p) => p.price)) : null;
  // Schema.org: Google stadionni joy sifatida taniydi (manzil, reyting, narx)
  const ld = s && {
    '@context': 'https://schema.org', '@type': 'SportsActivityLocation', name: s.name, url: `${SITE}/stadiums/${s.id}`,
    address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: 'Toshkent', addressRegion: s.district, addressCountry: 'UZ' },
    geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.photos[0] ? { image: abs(s.photos[0].url) } : {}),
    ...(min ? { priceRange: `${sum(min)} / soat` } : {}),
    ...(s.rating.avg && s.rating.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: s.rating.avg, reviewCount: s.rating.count } } : {}),
  };
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />}
      {children}
    </>
  );
}
