'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import FoogMark from './FoogMark';
import { Avatar, Icon } from './ui';
import { useSession } from '@/lib/session';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { get } from '@/lib/api';
import { useApi } from '@/lib/useApi';

type Mode = 'player' | 'owner' | 'admin';
type Item = { id: string; href: string; icon: string; label: string; badge?: number };

export function useThemeState() {
  const [t, setT] = useState<Theme>('dark');
  useEffect(() => {
    setT(getTheme());
    const f = (e: Event) => setT((e as CustomEvent).detail);
    window.addEventListener('foog-theme', f);
    return () => window.removeEventListener('foog-theme', f);
  }, []);
  return [t, () => setTheme(t === 'dark' ? 'light' : 'dark')] as const;
}

export function ThemeButton() {
  const [t, toggle] = useThemeState();
  return (
    <button className="icon-btn theme-btn" onClick={toggle} title={t === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'} aria-label={t === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}>
      <Icon n={t === 'dark' ? 'light_mode' : 'dark_mode'} size={22} />
    </button>
  );
}

function useBadges(mode: Mode) {
  const q = useApi<{ pending?: number; mod?: number; reports?: number }>(mode === 'player' ? null : `/${mode}/badges`);
  const { on } = useSession();
  useEffect(() => (mode === 'owner' ? on('booking', () => q.reload()) : undefined), [mode]);
  return q.data ?? {};
}

export default function TopBar({ mode: forced }: { mode?: Mode }) {
  const { me, unread, unreadChats, logout, staff } = useSession();
  const path = usePathname();
  const router = useRouter();
  const mode: Mode = forced ?? (me?.role === 'admin' ? 'admin' : me?.role === 'owner' ? 'owner' : 'player');
  const b = useBadges(mode);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ players: { id: string; name: string; username: string; avatarUrl: string | null; district: string | null }[]; stadiums: { id: string; name: string; district: string }[]; teams: { id: string; name: string; short: string }[] } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== 'player' || q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => get<typeof res>(`/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => setRes(null)), 220);
    return () => clearTimeout(t);
  }, [q, mode]);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setMenu(false); setRes(null); } };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
  useEffect(() => { setMenu(false); setRes(null); }, [path]);

  const items: Item[] = mode === 'admin'
    ? [
      { id: '/admin', href: '/admin', icon: 'space_dashboard', label: 'Umumiy' },
      { id: '/admin/stadiums', href: '/admin/stadiums', icon: 'stadium', label: 'Stadionlar', badge: b.mod },
      { id: '/admin/users', href: '/admin/users', icon: 'group', label: 'Foydalanuvchilar' },
      { id: '/admin/content', href: '/admin/content', icon: 'flag', label: 'Kontent', badge: b.reports },
      { id: '/admin/bookings', href: '/admin/bookings', icon: 'event_note', label: 'Bronlar' },
      { id: '/admin/audit', href: '/admin/audit', icon: 'history', label: 'Jurnal' },
    ]
    : mode === 'owner'
      ? [
        { id: '/owner', href: '/owner', icon: 'space_dashboard', label: 'Bosh sahifa' },
        { id: '/owner/bookings', href: '/owner/bookings', icon: 'event_note', label: 'Bronlar', badge: b.pending },
        { id: '/owner/schedule', href: '/owner/schedule', icon: 'calendar_view_week', label: 'Jadval' },
        { id: '/owner/stadiums', href: '/owner/stadiums', icon: 'stadium', label: 'Stadionlarim' },
        { id: '/owner/reels', href: '/owner/reels', icon: 'smart_display', label: 'Reels' },
        { id: '/owner/reports', href: '/owner/reports', icon: 'monitoring', label: 'Hisobot' },
      ]
      : [
        { id: '/home', href: '/home', icon: 'home', label: 'Asosiy' },
        { id: '/stadiums', href: '/stadiums', icon: 'stadium', label: 'Stadionlar' },
        { id: '/discover', href: '/discover', icon: 'explore', label: 'Izlash' },
        { id: '/reels', href: '/reels', icon: 'smart_display', label: 'Reels' },
        { id: '/messages', href: '/messages', icon: 'chat_bubble', label: 'Xabarlar', badge: unreadChats },
      ];
  const isOn = (id: string) => (id === '/owner' || id === '/admin' ? path === id : path === id || path.startsWith(id + '/')) || (id === '/discover' && path.startsWith('/matches'));
  const biz = mode !== 'player';
  const homeHref = mode === 'admin' ? '/admin' : mode === 'owner' ? '/owner' : '/home';
  const profHref = mode === 'owner' ? '/owner/profile' : mode === 'admin' ? '/admin' : '/profile';
  const searchPh = mode === 'admin' ? 'Foydalanuvchi, stadion, ID' : mode === 'owner' ? 'Mijoz yoki bron raqami' : 'FOOG’da qidirish';
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (mode === 'owner') router.push(`/owner/bookings?filter=all&q=${encodeURIComponent(v)}`);
    else if (mode === 'admin') router.push(v.toUpperCase().startsWith('FG-') ? `/admin/bookings?q=${encodeURIComponent(v)}` : v.toUpperCase().startsWith('ST-') ? `/admin/stadiums?q=${encodeURIComponent(v)}` : `/admin/users?q=${encodeURIComponent(v)}`);
    else router.push(`/discover?q=${encodeURIComponent(v)}`);
  };
  const nav = (cls: string) => items.map((n) => (
    <Link key={n.id} href={n.href} className={isOn(n.id) ? 'on' : ''} title={n.label} aria-current={isOn(n.id) ? 'page' : undefined}>
      <Icon n={n.icon} className="nav-ic" />
      <span className={cls}>{n.label}</span>
      {!!n.badge && !isOn(n.id) && <span className="badge-n">{n.badge}</span>}
    </Link>
  ));

  return (
    <header className={`topbar ${biz ? 'biz' : ''}`}>
      <div className="topbar-in">
        <Link href={me ? homeHref : '/'} className="brand" aria-label="FOOG – bosh sahifa">
          <span className="mk"><FoogMark ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></span>
          {biz && <span className="biz">{mode === 'admin' ? 'Admin' : 'Biznes'}</span>}
        </Link>
        {me && <nav className={`topnav ${biz ? 'biz-nav' : ''}`} aria-label="Asosiy navigatsiya">{nav('nav-lb')}</nav>}
        <div className="tools" ref={menuRef}>
          {me && (
            <form className="tsearch" onSubmit={onSearch} role="search">
              <Icon n="search" size={20} style={{ color: 'var(--text-2)' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPh} aria-label={searchPh} />
            </form>
          )}
          {res && (res.players.length + res.stadiums.length + res.teams.length > 0) && (
            <div className="search-pop">
              {res.stadiums.map((s) => <Link key={s.id} href={`/stadiums/${s.id}`}><Icon n="stadium" size={20} /><span className="grow ellipsis">{s.name}</span><span className="c3 t-cap">{s.district}</span></Link>)}
              {res.players.map((p) => <Link key={p.id} href={`/u/${p.username}`}><Avatar name={p.name} url={p.avatarUrl} size={28} /><span className="grow ellipsis">{p.name}</span><span className="c3 t-cap">@{p.username}</span></Link>)}
              {res.teams.map((t) => <Link key={t.id} href={`/discover?tab=teams&q=${encodeURIComponent(t.name)}`}><Avatar name={t.short} size={28} square /><span className="grow ellipsis">{t.name}</span></Link>)}
            </div>
          )}
          {mode === 'player' && me && <Link href="/discover" className="icon-btn only-mobile" aria-label="Qidirish"><Icon n="search" size={22} /></Link>}
          <ThemeButton />
          {me ? (
            <>
              <Link href="/notifications" className={`icon-btn bell ${path === '/notifications' ? 'on' : ''}`} title="Bildirishnomalar" aria-label={`Bildirishnomalar${unread ? `, ${unread} ta yangi` : ''}`}>
                <Icon n="notifications" size={22} fill={path === '/notifications'} />
                {!!unread && path !== '/notifications' && <span className="cnt">{unread > 99 ? '99+' : unread}</span>}
              </Link>
              <button className={`me ${path === profHref || path === `/u/${me.username}` ? 'on' : ''}`} onClick={() => setMenu((v) => !v)} aria-label="Profil menyusi" aria-expanded={menu}>
                <span style={{ background: me.avatarUrl ? `center/cover url("${me.avatarUrl}")` : mode === 'admin' ? 'oklch(0.75 0.12 200)' : mode === 'owner' ? 'oklch(0.72 0.1 40)' : 'oklch(0.75 0.12 262)' }}>
                  {!me.avatarUrl && me.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </span>
              </button>
              {menu && (
                <div className="menu" style={{ top: 52, right: 0 }}>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontWeight: 700 }}>{me.name}</div>
                    <div className="c3 t-cap">@{me.username} · {me.role === 'admin' ? 'Administrator' : me.role === 'owner' ? 'Stadion egasi' : staff ? 'Stadion xodimi' : 'Futbolchi'}</div>
                  </div>
                  {mode !== 'admin' && <Link href={profHref}><Icon n="person" />Profil</Link>}
                  {mode === 'player' && <Link href="/bookings"><Icon n="event_available" />Bronlarim</Link>}
                  {mode === 'player' && <Link href="/profile/edit"><Icon n="edit" />Profilni tahrirlash</Link>}
                  {mode === 'owner' && <Link href="/owner/reviews"><Icon n="reviews" />Sharhlar</Link>}
                  {mode === 'owner' && <Link href="/owner/profile#staff"><Icon n="badge" />Xodimlar</Link>}
                  {staff && mode === 'player' && <Link href="/owner"><Icon n="storefront" />Stadion paneli</Link>}
                  {mode === 'owner' && me.role !== 'owner' && <Link href="/home"><Icon n="sports_soccer" />Futbolchi sahifasi</Link>}
                  <button onClick={() => setTheme(getTheme() === 'dark' ? 'light' : 'dark')}><Icon n="contrast" />Tungi / kunduzgi rejim</button>
                  <button className="danger" onClick={logout}><Icon n="logout" />Chiqish</button>
                </div>
              )}
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn btn-primary btn-sm">Kirish</Link>
          )}
        </div>
      </div>
      {me && <nav className="subnav" aria-label="Asosiy navigatsiya (mobil)">{items.map((n) => (
        <Link key={n.id} href={n.href} className={isOn(n.id) ? 'on' : ''}><Icon n={n.icon} fill={isOn(n.id)} />{n.label}{!!n.badge && !isOn(n.id) && <span className="badge-n">{n.badge}</span>}</Link>
      ))}</nav>}
    </header>
  );
}
