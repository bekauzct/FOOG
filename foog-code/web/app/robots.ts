import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://foog.uz';

// Qidiruv tizimlari uchun: ochiq sahifalar indekslanadi, kabinetlar va API – yo‘q
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/stadiums'], disallow: ['/api/', '/admin', '/owner', '/home', '/bookings', '/messages', '/notifications', '/profile', '/login'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
