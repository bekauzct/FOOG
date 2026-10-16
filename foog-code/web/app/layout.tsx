import type { Metadata, Viewport } from 'next';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import 'material-symbols/rounded.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { themeScript } from '@/lib/theme';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from '@/lib/toast';

export const metadata: Metadata = {
  title: { default: 'FOOG – Hamma uchun futbol ekotizimi', template: '%s · FOOG' },
  description: 'Toshkentda stadion toping, bir necha soniyada bron qiling, o‘yinchilar va jamoalarni toping. To‘lov stadionda.',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d1226' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
