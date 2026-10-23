import type { Metadata, Viewport } from 'next';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { themeScript } from '@/lib/theme';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from '@/lib/toast';
import Foogi from '@/components/Foogi';
import { cookies } from 'next/headers';
import { LangProvider, type Lang } from '@/lib/i18n';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://foog.uz';
const DESC = 'Toshkentda stadion toping, bir necha soniyada bron qiling, o‘yinchilar va jamoalarni toping. To‘lov stadionda.';
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'FOOG – Hamma uchun futbol ekotizimi', template: '%s · FOOG' },
  description: DESC,
  keywords: ['FOOG', 'foog.uz', 'stadion bron', 'futbol maydoni Toshkent', 'mini futbol', 'futbol o‘yinchilari', 'бронирование футбольного поля Ташкент', 'футбольное поле аренда', 'мини-футбол Ташкент'],
  applicationName: 'FOOG',
  icons: { icon: '/favicon.svg' },
  openGraph: { type: 'website', url: SITE, siteName: 'FOOG', title: 'FOOG – Hamma uchun futbol ekotizimi', description: DESC, locale: 'uz_UZ', alternateLocale: ['ru_RU'] },
  twitter: { card: 'summary', title: 'FOOG – Hamma uchun futbol ekotizimi', description: DESC },
  robots: { index: true, follow: true },
  ...(process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION } } : {}),
};
// Brend ma’lumoti: Google «FOOG» ni alohida nom sifatida taniydi (food emas) va ijtimoiy tarmoqlarni bog‘laydi
const BRAND_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'FOOG', alternateName: ['foog.uz', 'FOOG Uzbekistan', 'FOOG – Hamma uchun futbol ekotizimi'], inLanguage: ['uz', 'ru'], publisher: { '@id': `${SITE}/#org` } },
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'FOOG', url: `${SITE}/`, logo: `${SITE}/favicon.svg`, description: 'Toshkentdagi futbol ekotizimi: stadion bron qilish, o‘yinchilar va jamoalar.', areaServed: 'Tashkent', sameAs: ['https://instagram.com/foog_pro', 'https://t.me/foog_pro'] },
  ],
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d1226' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = cookies().get('foog_lang')?.value === 'ru' ? 'ru' : 'uz';
  return (
    <html lang={lang} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BRAND_LD) }} />
      </head>
      <body>
        <LangProvider initial={lang}>
          <SessionProvider>
            <ToastProvider>{children}<Foogi /></ToastProvider>
          </SessionProvider>
        </LangProvider>
      </body>
    </html>
  );
}
