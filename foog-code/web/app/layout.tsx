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
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d1226' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = cookies().get('foog_lang')?.value === 'ru' ? 'ru' : 'uz';
  return (
    <html lang={lang} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LangProvider initial={lang}>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </LangProvider>
      </body>
    </html>
  );
}
