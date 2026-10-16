import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Rol bo‘yicha bo‘limlar: /home… – futbolchi, /owner – stadion egasi (va xodimi), /admin – admin.
// Asosiy tekshiruv API da ham bor; bu yerda – noto‘g‘ri bo‘limga kirishda yo‘naltirish.
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
const PLAYER = ['/home', '/bookings', '/discover', '/matches', '/reels', '/messages', '/profile', '/u'];
// /notifications – barcha rollar uchun (rolga mos topbar bilan)

async function claims(req: NextRequest) {
  const t = req.cookies.get('foog_token')?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret);
    return payload as { sub: string; role: 'player' | 'owner' | 'admin'; staff?: boolean };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const c = await claims(req);
  const home = c ? (c.role === 'admin' ? '/admin' : c.role === 'owner' || c.staff ? '/owner' : '/home') : '/';
  const toLogin = () => NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, req.url));

  if (pathname === '/login' && c) return NextResponse.redirect(new URL(home, req.url));
  if (pathname === '/notifications' && !c) return toLogin();
  if (pathname.startsWith('/admin')) {
    if (!c) return toLogin();
    if (c.role !== 'admin') return NextResponse.redirect(new URL(home, req.url));
  }
  if (pathname.startsWith('/owner')) {
    if (!c) return toLogin();
    if (c.role !== 'owner' && c.role !== 'admin' && !c.staff) return NextResponse.redirect(new URL(home, req.url));
  }
  if (PLAYER.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (!c) return toLogin();
    // Har bir rol o‘z bo‘limini ko‘radi: egasi va admin futbolchi bo‘limiga yo‘naltirilmaydi
    if (c.role !== 'player') return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|uploads|_next|favicon|.*\\..*).*)'] };
