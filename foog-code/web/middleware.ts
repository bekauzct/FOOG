import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Rol bo‘yicha bo‘limlar: /home… – futbolchi, /owner – stadion egasi (va xodimi), /admin – admin.
// Asosiy tekshiruv API da ham bor; bu yerda – noto‘g‘ri bo‘limga kirishda yo‘naltirish.
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
const PLAYER = ['/home', '/bookings', '/discover', '/matches', '/reels', '/messages', '/profile', '/u', '/team'];
// /notifications – barcha rollar uchun (rolga mos topbar bilan)

/** Kirgandan keyin qaytish manzili: faqat sayt ichidagi va shu rolga ochiq yo‘l */
function nextAllowed(next: string, c: { role: string; staff?: boolean }, home: string) {
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/login')) return false;
  if (next.startsWith('/obyektivka/') || next === '/notifications') return true;
  if (home === '/home') return !next.startsWith('/owner') && !next.startsWith('/admin');
  if (home === '/owner') return next.startsWith('/owner') || next === '/team' || next.startsWith('/team/');
  return next.startsWith(home);
}

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
  // www.foog.uz → foog.uz (qidiruv tizimlari uchun bitta manzil)
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('www.')) return NextResponse.redirect(`https://${host.slice(4)}${pathname}${search}`, 301);
  const c = await claims(req);
  const home = c ? (c.role === 'admin' ? '/admin' : c.role === 'owner' || c.staff ? '/owner' : '/home') : '/';
  const toLogin = () => NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, req.url));

  if (pathname === '/login' && c) {
    // reauth=1 – nginx obyektivkadan qaytardi (sessiya API’da yaroqsiz, masalan hisob bloklangan): sahifani ochamiz, aylanib qolmaydi
    if (req.nextUrl.searchParams.get('reauth')) return NextResponse.next();
    const next = req.nextUrl.searchParams.get('next');
    return NextResponse.redirect(new URL(next && nextAllowed(next, c, home) ? next : home, req.url));
  }
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
    // Jamoam – futbolchi va stadion egasi uchun (menyuda)
    const ownerTeam = c.role === 'owner' && (pathname === '/team' || pathname.startsWith('/team/'));
    if (c.role !== 'player' && !ownerTeam) return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|uploads|_next|favicon|.*\\..*).*)'] };
