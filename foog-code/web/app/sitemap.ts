import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://foog.uz';
const API = process.env.API_URL || 'http://localhost:4000';

// Ochiq sahifalar va har bir faol stadion sahifasi. Har so‘rovda yig‘iladi, stadionlar ro‘yxati soatiga bir yangilanadi
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/stadiums`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ];
  try {
    const r = await fetch(`${API}/api/v1/stadiums`, { next: { revalidate: 3600 } });
    const j = (await r.json()) as { items?: { id: string }[] };
    for (const s of j.items ?? []) pages.push({ url: `${SITE}/stadiums/${s.id}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 });
  } catch { /* API ishlamasa ham asosiy sahifalar qaytadi */ }
  return pages;
}
