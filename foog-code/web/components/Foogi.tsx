'use client';
// FOOGI – FOOG’ning yordamchisi va maskoti. Har sahifada ekranning o‘ng pastki burchagida turadi:
// varaqlaganda yuguradi, 30 s harakatsizlikda uxlaydi, sahifani tanishtiradi (sayr), savollarga javob beradi
// (javoblarni admin o‘rgatadi – tashqi API yo‘q), mehmonni kirishga undaydi va sayrdan keyin takliflar beradi.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './ui';
import { get, post } from '@/lib/api';
import { useSession } from '@/lib/session';

type Step = { id: string; target: string; title: string; text: string; pose: string };
type Tip = { id: string; title: string | null; text: string; pose: string; label: string | null; href: string | null };
type Boot = { audience: 'guest' | 'player' | 'owner' | 'admin'; tour: Step[]; site: Step[]; tips: Tip[]; chips: { answerId: string; title: string }[] };
type Msg = { from: 'me' | 'foogi'; text: string; href?: string | null; label?: string | null; id?: string; matched?: boolean; voted?: boolean; sug?: { answerId: string; title: string }[] };
type Btn = { t: string; fn: () => void; main?: boolean; href?: string };
type Bubble = { tag: string; title?: string | null; text: string; btns?: Btn[]; tour?: boolean };

export const poseSrc = (p: string) => `/foogi/${p}.webp`;
const PRELOAD = ['wave_hello', 'run', 'scooter', 'sleep', 'surprised', 'typing', 'thinking', 'thumbs_up', 'present', 'goal_celebration', 'ketdik', 'telegram_time', 'facepalm'];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* yopiq */ } } };
const ss = { get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* yopiq */ } }, del: (k: string) => { try { sessionStorage.removeItem(k); } catch { /* yopiq */ } } };

/** Yo‘l → sahifa kaliti (sayr qadamlari shu kalit bo‘yicha) */
export function pageKey(p: string) {
  if (p === '/') return 'landing';
  if (p.startsWith('/stadiums/')) return 'stadium';
  if (p.startsWith('/matches')) return 'discover';
  if (p === '/profile/edit') return 'profile-edit';
  if (p.startsWith('/u/')) return 'user';
  if (p.startsWith('/messages')) return 'messages';
  const seg = p.split('/').filter(Boolean);
  if (seg[0] === 'owner' || seg[0] === 'admin') return seg.length > 1 ? `${seg[0]}-${seg[1]}` : seg[0];
  return seg[0] ?? 'landing';
}
// target: data-tour kaliti (masalan "list") yoki CSS selektor; belgilanmagan sahifalarda umumiy konteynerga tushadi
const FALLBACK: Record<string, string> = { list: '.page-narrow, .page, main', profile: '.page, main', grid: 'main, .page', report: 'main, .page', slots: 'main, .page', team: '.page, main' };
function findTarget(t: string) {
  if (!t) return null;
  if (t === 'foogi') return document.querySelector<HTMLElement>('[data-foogi-self]');
  if (!/^[a-z0-9-]+$/.test(t)) { try { return document.querySelector<HTMLElement>(t); } catch { return null; } }
  return document.querySelector<HTMLElement>(`[data-tour="${t}"]`) ?? (FALLBACK[t] ? document.querySelector<HTMLElement>(FALLBACK[t]) : null);
}
const visible = (el: HTMLElement | null) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
// saytning to‘liq sayri: target = "/yo‘l#kalit"
const split = (t: string) => { const i = t.indexOf('#'); return i < 0 ? { path: t, key: '' } : { path: t.slice(0, i), key: t.slice(i + 1) }; };
const dialogOpen = () => !!document.querySelector('.overlay');

export default function Foogi() {
  const path = usePathname() || '/';
  const router = useRouter();
  const { me, loading } = useSession();
  const page = pageKey(path);
  const aud = me ? me.role : 'guest';

  const [boot, setBoot] = useState<Boot | null>(null);
  const [pose, setPoseS] = useState('wave_hello');
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState<{ kind: 'page' | 'site'; i: number } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [muted, setMuted] = useState(false);

  const fRef = useRef<HTMLDivElement>(null), imgRef = useRef<HTMLImageElement>(null), hlRef = useRef<HTMLDivElement>(null), bRef = useRef<HTMLDivElement>(null), msgRef = useRef<HTMLDivElement>(null);
  const st = useRef({ cur: null as null | { x: number; y: number; S: number }, lastY: 0, vel: 0, drift: 0, pop: 0, flip: false, lastMove: 0, lastAct: Date.now(), pose2: 0, secT: 0, hold: false, poseNow: 'wave_hello' });
  const bT = useRef<ReturnType<typeof setTimeout>>();
  const live = useRef({ bubble, open, tour, sleeping, muted, boot, typing });
  live.current = { bubble, open, tour, sleeping, muted, boot, typing };

  const setPose = useCallback((p?: string) => { if (p && p !== st.current.poseNow) { st.current.poseNow = p; st.current.pop = 1; setPoseS(p); } }, []);
  const say = useCallback((b: Bubble & { pose?: string; ms?: number }) => {
    clearTimeout(bT.current);
    setPose(b.pose);
    setBubble(b);
    if (b.ms) bT.current = setTimeout(() => { if (!st.current.hold) setBubble(null); }, b.ms);
  }, [setPose]);

  // --- boshlang‘ich holat: rasmlarni oldindan yuklash, chat tarixi, uxlatilganmi
  useEffect(() => {
    PRELOAD.forEach((n) => { const i = new Image(); i.src = poseSrc(n); });
    setMuted(ls.get('foogi-muted') === '1');
    try { const m = JSON.parse(ss.get('foogi-chat') || '[]'); if (Array.isArray(m)) setMsgs(m.slice(-40)); } catch { /* bo‘sh */ }
  }, []);
  useEffect(() => { ss.set('foogi-chat', JSON.stringify(msgs.slice(-40))); }, [msgs]);
  useEffect(() => { const m = msgRef.current; if (m) m.scrollTop = m.scrollHeight; }, [msgs, typing, open]);

  // --- sahifa almashganda: sayr, takliflar va tezkor tugmalarni olish
  useEffect(() => {
    if (loading) return;
    let dead = false;
    setBoot(null); setBubble(null);
    get<Boot>(`/foogi/boot?page=${encodeURIComponent(page)}&path=${encodeURIComponent(path)}`).then((b) => { if (!dead) setBoot(b); }).catch(() => undefined);
    return () => { dead = true; };
  }, [page, path, loading, aud]);

  // --- sayr qadamlari
  const steps = useCallback((kind: 'page' | 'site') => {
    const b = live.current.boot;
    if (!b) return [] as Step[];
    if (kind === 'site') return b.site;
    return b.tour.filter((s) => visible(findTarget(s.target)));
  }, []);
  const tourKey = (kind: 'page' | 'site') => (kind === 'site' ? `foogi-site-${aud}` : `foogi-tour-${page}`);
  const endTour = useCallback((kind: 'page' | 'site', done: boolean) => {
    setTour(null);
    ls.set(tourKey(kind), done ? 'done' : 'skipped');
    ls.set(`foogi-intro-${page}`, '1');
    if (kind === 'site') ss.del('foogi-site-run');
    if (done) say({ pose: 'goal_celebration', tag: 'FOOGI · tayyor', title: 'Gooool! Sayr tugadi', text: 'Endi hammasini bilasiz. Savol bo‘lsa – meni bosing, men doim shu yerdaman.', ms: 7000 });
    // mehmon: sayrdan keyin kirishga undash
    if (!me) setTimeout(() => nudgeLogin(), done ? 9000 : 1500);
  }, [page, aud, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const goStep = useCallback((kind: 'page' | 'site', i: number) => {
    const list = steps(kind);
    const s = list[i];
    if (!s) return endTour(kind, true);
    if (kind === 'site') {
      const { path: p } = split(s.target);
      ss.set('foogi-site-run', String(i));
      if (p && p !== path) { setTour(null); setBubble(null); router.push(p); return; }
    }
    const el = findTarget(kind === 'site' ? split(s.target).key : s.target);
    if (el && el.getAttribute('data-foogi-self') === null) { const r = el.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, r.top + window.scrollY - window.innerHeight * 0.28), behavior: 'smooth' }); }
    setPose(s.pose || 'present');
    setBubble(null);
    setTour({ kind, i });
  }, [steps, endTour, path, router, setPose]);
  const startTour = useCallback((kind: 'page' | 'site' = 'page') => {
    ls.set(`foogi-intro-${page}`, '1');
    setOpen(false);
    if (!steps(kind).length) { say({ pose: 'thinking', tag: 'FOOGI', text: 'Bu sahifada sayr yo‘q – lekin savol bersangiz, javob beraman.', ms: 4500 }); return; }
    goStep(kind, 0);
  }, [page, steps, goStep, say]);

  // to‘liq sayr boshqa sahifaga o‘tgach davom etadi
  useEffect(() => {
    if (!boot) return;
    const run = ss.get('foogi-site-run');
    if (run !== null) { const i = +run; const t = setTimeout(() => goStep('site', i), 700); return () => clearTimeout(t); }
  }, [boot]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- mehmonni kirishga undash
  const nudgeLogin = useCallback(() => {
    if (me || live.current.muted) return;
    const n = +(ss.get('foogi-nudges') || 0);
    if (n >= 3) return;
    ss.set('foogi-nudges', String(n + 1));
    say({ pose: 'telegram_time', tag: 'FOOGI · taklif', title: 'Keling, tanishamiz!', text: 'Telegram orqali 10 soniyada kiring – bron qilish, o‘yinga qo‘shilish va jamoa tuzish ochiladi.', ms: 12000,
      btns: [{ t: 'Kirish', main: true, href: `/login?next=${encodeURIComponent(path === '/login' ? '/' : path)}`, fn: () => setBubble(null) }, { t: 'Keyinroq', fn: () => setBubble(null) }] });
  }, [me, path, say]);

  // --- birinchi tashrif: sayrga taklif (kirgan foydalanuvchiga – saytning to‘liq sayri)
  useEffect(() => {
    if (!boot || muted || ss.get('foogi-site-run') !== null) return;
    const siteNew = !!me && boot.site.length > 0 && !ls.get(tourKey('site'));
    const pageNew = !ls.get(`foogi-intro-${page}`) && boot.tour.some((s) => visible(findTarget(s.target)));
    const t = setTimeout(() => {
      if (live.current.tour || live.current.open) return;
      if (siteNew) {
        say({ pose: 'wave_hello', tag: 'FOOGI · salom', title: `Salom${me ? `, ${me.name.split(' ')[0]}` : ''}! Men FOOGI`, text: 'Saytni to‘liq ko‘rsatib beraymi? Bir daqiqa – va hammasini bilasiz.',
          btns: [{ t: 'Ha, ketdik!', main: true, fn: () => startTour('site') }, { t: 'Keyinroq', fn: () => { ls.set(tourKey('site'), 'later'); setBubble(null); } }] });
      } else if (pageNew) {
        say({ pose: 'wave_hello', tag: 'FOOGI · salom', title: me ? 'Bu sahifani ko‘rsataymi?' : 'Salom! Men FOOGI', text: me ? 'Qisqa sayr – 20 soniya.' : 'FOOG bilan 30 soniyada tanishtiraman. Ketdikmi?',
          btns: [{ t: 'Ha, ketdik!', main: true, fn: () => startTour('page') }, { t: 'Keyinroq', fn: () => { ls.set(`foogi-intro-${page}`, '1'); setBubble(null); if (!me) setTimeout(nudgeLogin, 20000); } }] });
      } else if (!me) {
        setTimeout(nudgeLogin, 15000);
      }
    }, 1300);
    return () => clearTimeout(t);
  }, [boot, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- sayrdan keyin: takliflar (vaqti-vaqti bilan, ko‘rilmaganlari birinchi)
  useEffect(() => {
    if (!boot || !boot.tips.length) return;
    let n = 0;
    const tick = () => {
      const L = live.current;
      const tourHandled = !L.boot?.tour.length || !!ls.get(`foogi-intro-${page}`);
      if (L.muted || L.open || L.tour || L.bubble || L.sleeping || L.typing || document.hidden || dialogOpen() || !tourHandled) return;
      if (ss.get('foogi-site-run') !== null) return;
      let seen: string[] = []; try { seen = JSON.parse(ls.get('foogi-tips-seen') || '[]'); } catch { /* bo‘sh */ }
      let tip = boot.tips.find((x) => !seen.includes(x.id));
      if (!tip) { if (n++ % 3) return; seen = []; tip = boot.tips[Math.floor(Math.random() * boot.tips.length)]; }
      ls.set('foogi-tips-seen', JSON.stringify([...seen, tip.id].slice(-200)));
      say({ pose: tip.pose, tag: aud === 'guest' ? 'FOOGI · taklif' : 'FOOGI · maslahat', title: tip.title, text: tip.text, ms: 11000,
        btns: tip.href ? [{ t: tip.label || 'Ochish', main: true, href: tip.href === '/login' ? `/login?next=${encodeURIComponent(path)}` : tip.href, fn: () => setBubble(null) }] : undefined });
    };
    const first = setTimeout(tick, aud === 'guest' ? 30000 : 25000);
    const every = setInterval(tick, 95000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [boot]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- sahifalar FOOGI’ni gapirtira oladi: window.dispatchEvent(new CustomEvent('foogi:say', { detail }))
  useEffect(() => {
    const f = (e: Event) => { const d = (e as CustomEvent).detail || {}; if (live.current.muted && !d.force) return; say({ pose: d.pose, tag: d.tag || 'FOOGI', title: d.title, text: d.text, ms: d.ms ?? 6000, btns: d.cta ? [{ t: d.cta.t, main: true, href: d.cta.href, fn: () => setBubble(null) }] : undefined }); };
    const l = () => nudgeLogin();
    window.addEventListener('foogi:say', f); window.addEventListener('foogi:login', l);
    return () => { window.removeEventListener('foogi:say', f); window.removeEventListener('foogi:login', l); };
  }, [say, nudgeLogin]);

  // --- uyg‘otish va harakat kuzatuvi
  useEffect(() => {
    const s = st.current;
    s.lastY = window.scrollY;
    const wake = () => { s.lastAct = Date.now(); if (live.current.sleeping && !live.current.muted) { setSleeping(false); setPose('surprised'); s.pose2 = Date.now() + 1200; } };
    const onScroll = () => { s.lastMove = Date.now(); wake(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('mousemove', wake); window.removeEventListener('keydown', wake); window.removeEventListener('touchstart', wake); };
  }, [setPose]);

  // --- kadr sikli: joylashuv, harakat, pozalar (React render’siz, transform to‘g‘ridan-to‘g‘ri)
  useEffect(() => {
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const f = fRef.current; if (!f) return;
      const s = st.current, L = live.current, now = Date.now();
      const vw = window.innerWidth, vh = window.innerHeight, mob = vw < 640;
      const y0 = window.scrollY, dv = y0 - s.lastY; s.lastY = y0; s.vel = lerp(s.vel, dv, 0.3);
      let S = mob ? 84 : 124, x = vw - S - (mob ? 8 : 22), y = vh - S - (mob ? 76 : 22);
      let mode: 'dock' | 'tour' | 'open' | 'peek' = 'dock';
      const hl = hlRef.current;
      if (L.open) { mode = 'open'; S = mob ? 72 : 108; x = vw - S - (mob ? 10 : 16); y = mob ? 8 : vh - S - 16; }
      else if (L.tour) {
        mode = 'tour';
        const list = L.tour.kind === 'site' ? (L.boot?.site ?? []) : (L.boot?.tour ?? []).filter((q) => visible(findTarget(q.target)));
        const step = list[L.tour.i];
        const el = step ? findTarget(L.tour.kind === 'site' ? split(step.target).key : step.target) : null;
        S = mob ? 92 : 140;
        if (el && hl) {
          const r = el.getBoundingClientRect();
          const self = el.hasAttribute('data-foogi-self');
          hl.style.display = self ? 'none' : 'block';
          hl.style.transform = `translate(${r.left - 8}px, ${r.top - 8}px)`; hl.style.width = r.width + 16 + 'px'; hl.style.height = r.height + 16 + 'px';
          if (!self) {
            if (r.right + S + 24 < vw) { x = r.right + 12; y = clamp(r.top + r.height / 2 - S / 2, 76, vh - S - 12); }
            else if (r.left - S - 24 > 0) { x = r.left - S - 12; y = clamp(r.top + r.height / 2 - S / 2, 76, vh - S - 12); }
            else { x = clamp(r.right - S, 8, vw - S - 8); y = clamp(r.bottom + 8, 76, vh - S - 12); if (y + S > vh - 12) y = clamp(r.top - S - 8, 76, vh - S - 12); }
          }
        } else if (hl) hl.style.display = 'none';
      } else if (dialogOpen()) { mode = 'peek'; S = mob ? 64 : 84; x = vw - S * 0.45; y = vh - S - 90; }
      if (mode !== 'tour' && hl) hl.style.display = 'none';
      if (mode === 'dock' && !reduced) { s.drift = lerp(s.drift, clamp(s.vel * 3, -90, 90), 0.12); y = clamp(y - Math.abs(s.drift) * 0.2 + s.drift, 70, vh - S - 8); }
      if (!s.cur) s.cur = { x, y, S };
      const k = reduced ? 1 : 0.14;
      s.cur.x = lerp(s.cur.x, x, k); s.cur.y = lerp(s.cur.y, y, k); s.cur.S = lerp(s.cur.S, S, k);
      const bob = reduced ? 0 : mode === 'tour' || mode === 'open' ? Math.sin(now / 420) * 3 : Math.sin(now / 600) * 5;
      f.style.width = f.style.height = s.cur.S.toFixed(1) + 'px';
      // mobilda chat ochiq bo‘lsa FOOGI panel sarlavhasida – ekrandagi tugmalarni yopmaydi
      f.style.visibility = L.open && mob ? 'hidden' : 'visible';
      f.style.transform = `translate3d(${s.cur.x.toFixed(1)}px, ${(s.cur.y + bob).toFixed(1)}px, 0)`;
      s.pop = lerp(s.pop, 0, 0.12);
      const img = imgRef.current;
      if (img) {
        const fl = s.flip ? -1 : 1, tilt = reduced ? 0 : clamp(s.vel * 0.4, -8, 8);
        img.style.transform = `scale(${(fl * (1 + s.pop * 0.14)).toFixed(3)}, ${(1 + s.pop * 0.14).toFixed(3)}) rotate(${(tilt * fl).toFixed(2)}deg)`;
      }
      // pufak FOOGI yonida, ekrandan chiqmaydi
      const b = bRef.current;
      if (b) {
        const bw = b.offsetWidth, bh = b.offsetHeight, cx = s.cur.x, cy = s.cur.y;
        let bx = cx + s.cur.S / 2 > vw / 2 ? cx - bw - 8 : cx + s.cur.S + 8;
        let by = cy + s.cur.S - bh;
        if (mob || bx < 8 || bx + bw > vw - 8) { bx = clamp(cx + s.cur.S - bw, 8, vw - bw - 8); by = cy - bh - 6; if (by < 70) by = cy + s.cur.S + 6; }
        b.style.transform = `translate(${clamp(bx, 8, vw - bw - 8).toFixed(1)}px, ${clamp(by, 70, vh - bh - 8).toFixed(1)}px)`;
      }
      // pozalar: varaqlash → yugurish/samokat, to‘xtaganda – sahifa pozasi, 30 s – uyqu
      if (mode === 'dock' && !L.typing) {
        const moving = now - s.lastMove < 320 && Math.abs(s.vel) > 1.2;
        if (moving && !L.sleeping) { s.flip = s.vel < 0; setPose(Math.abs(s.vel) > 26 ? 'scooter' : 'run'); s.secT = now; }
        else if (now > s.pose2 && now - s.secT > 140) {
          s.flip = false;
          if (L.muted || (!L.sleeping && !L.bubble && now - Math.max(s.lastAct, s.lastMove) > 30000)) { if (!L.sleeping) setSleeping(true); setPose('sleep'); }
          else if (!L.sleeping && !L.bubble && ['run', 'scooter', 'surprised', 'typing', 'sleep'].includes(s.poseNow)) setPose(L.boot?.tour[0]?.pose ?? 'wave_hello');
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [setPose]);

  // --- chat
  const ask = async (text: string, answerId?: string) => {
    const t = text.trim();
    if ((!t && !answerId) || typing) return;
    if (!answerId && /\b(sayr|tutorial|ko.?rsat|tanishtir)/i.test(t)) {
      setMsgs((m) => [...m, { from: 'me', text: t }, { from: 'foogi', text: 'Ketdik! Qisqa sayr qilamiz.' }]); setDraft('');
      setTimeout(() => startTour(me && /sayt|to.?liq|hammasi/i.test(t) ? 'site' : 'page'), 500);
      return;
    }
    setMsgs((m) => [...m, { from: 'me', text: t }]); setDraft(''); setTyping(true); setPose('typing');
    try {
      const r = await post<{ id?: string; matched: boolean; text: string; pose: string; href?: string | null; label?: string | null; suggestions?: { answerId: string; title: string }[] }>('/foogi/ask', answerId ? { answerId, page } : { text: t, page });
      await new Promise((ok) => setTimeout(ok, 450));
      setPose(r.pose || 'thumbs_up');
      setMsgs((m) => [...m, { from: 'foogi', text: r.text, href: r.href, label: r.label, id: r.id, matched: r.matched, sug: r.suggestions }]);
    } catch (e) {
      setPose('no_connection');
      setMsgs((m) => [...m, { from: 'foogi', text: (e as Error).message || 'Aloqa yo‘q – internetni tekshirib, qayta yozing.' }]);
    } finally { setTyping(false); }
  };
  const vote = async (i: number, helpful: boolean) => {
    const m = msgs[i]; if (!m.id) return;
    setMsgs((all) => all.map((x, k) => (k === i ? { ...x, voted: true } : x)));
    setPose(helpful ? 'thumbs_up' : 'sad_tear_ball');
    try { await post('/foogi/feedback', { id: m.id, helpful }); } catch { /* muhim emas */ }
    if (!helpful) setMsgs((all) => [...all, { from: 'foogi', text: 'Uzr! Bu savolni adminga yubordim – to‘g‘ri javobni o‘rganaman.' }]);
  };
  const setMute = (v: boolean) => { setMuted(v); ls.set('foogi-muted', v ? '1' : '0'); setSleeping(v); setPose(v ? 'sleep' : 'surprised'); if (v) { setOpen(false); setBubble(null); } };
  const toggleOpen = () => {
    st.current.lastAct = Date.now();
    if (muted) { setMute(false); setOpen(true); return; }
    if (sleeping) { setSleeping(false); setPose('surprised'); st.current.pose2 = Date.now() + 1000; return; }
    const o = !open;
    setOpen(o); setTour(null); setBubble(null);
    if (o) { setPose('wave_hello'); if (!msgs.length) setMsgs([{ from: 'foogi', text: me ? `Salom, ${me.name.split(' ')[0]}! Men FOOGI – yordamchingiz. Savol bering yoki tugmalardan birini tanlang.` : 'Salom! Men FOOGI – FOOG’dagi yordamchingiz. Savol bering yoki tugmalardan birini tanlang.' }]); }
    ls.set(`foogi-intro-${page}`, '1');
  };

  // --- sayr pufagi
  const list = tour ? (tour.kind === 'site' ? boot?.site ?? [] : (boot?.tour ?? []).filter((q) => visible(findTarget(q.target)))) : [];
  const step = tour ? list[tour.i] : null;
  const shown: Bubble | null = step && tour
    ? { tag: `${tour.kind === 'site' ? 'Sayt sayri' : 'Sayr'} · ${tour.i + 1} / ${list.length}`, title: step.title, text: step.text, tour: true,
      btns: [tour.i > 0 ? { t: 'Orqaga', fn: () => goStep(tour.kind, tour.i - 1) } : { t: 'O‘tkazish', fn: () => endTour(tour.kind, false) }, { t: tour.i === list.length - 1 ? 'Tugatish' : 'Keyingi', main: true, fn: () => goStep(tour.kind, tour.i + 1) }] }
    : bubble;
  const chips = [
    ...(boot?.tour.length ? [{ t: 'Sayrni boshlash', fn: () => startTour('page') }] : []),
    ...(me && boot?.site.length ? [{ t: 'Saytni to‘liq ko‘rsat', fn: () => startTour('site') }] : []),
    ...(!me ? [{ t: 'Qanday kiraman?', fn: () => ask('Qanday kiraman?') }] : []),
    ...(boot?.chips ?? []).map((c) => ({ t: c.title, fn: () => ask(c.title, c.answerId) })),
  ];

  return (
    <div className="foogi-root" aria-live="polite">
      <div ref={hlRef} className="foogi-hl" />
      <div ref={fRef} className="foogi" data-foogi-self="">
        <button className="foogi-btn" onClick={toggleOpen} aria-label="FOOGI yordamchi" title="FOOGI – yordamchingiz" aria-expanded={open}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={poseSrc(pose)} alt="" draggable={false} onError={(e) => { (e.target as HTMLImageElement).src = poseSrc('wave_hello'); }} />
        </button>
        {!open && !shown && !sleeping && !muted && <span className="foogi-dot" />}
        {sleeping && <span className="foogi-z" aria-hidden="true">z</span>}
      </div>
      {shown && !open && (
        <div ref={bRef} className="foogi-bubble" role="dialog" aria-label={shown.title || 'FOOGI'} onMouseEnter={() => { st.current.hold = true; }} onMouseLeave={() => { st.current.hold = false; }}>
          <div className="row between" style={{ gap: 8 }}>
            <span className="foogi-tag">{shown.tag}</span>
            <button className="icon-btn ghost sm" aria-label="Yopish" onClick={() => { if (tour) endTour(tour.kind, false); else setBubble(null); }}><Icon n="close" size={18} /></button>
          </div>
          {shown.title && <b className="foogi-title">{shown.title}</b>}
          <p className="foogi-text">{shown.text}</p>
          {!!shown.btns?.length && (
            <div className="row wrap" style={{ gap: 8 }}>
              {shown.btns.map((b) => (b.href
                ? <Link key={b.t} href={b.href} className={`btn btn-sm ${b.main ? 'btn-primary' : 'btn-outline'}`} onClick={b.fn}>{b.t}</Link>
                : <button key={b.t} className={`btn btn-sm ${b.main ? 'btn-primary' : 'btn-outline'}`} onClick={b.fn}>{b.t}</button>))}
            </div>
          )}
        </div>
      )}
      {open && (
        <div className="foogi-panel" role="dialog" aria-label="FOOGI bilan suhbat">
          <div className="foogi-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="foogi-av"><img src={poseSrc('wave_hello')} alt="" /></span>
            <span className="col grow" style={{ minWidth: 0 }}><b style={{ fontSize: 16 }}>FOOGI</b><span className="row c2" style={{ gap: 6, fontSize: 12 }}><span className="foogi-on" />{typing ? 'yozmoqda…' : 'yordamchi · doim shu yerda'}</span></span>
            <button className="icon-btn ghost sm" title="Uxlatish – takliflar to‘xtaydi" aria-label="FOOGI’ni uxlatish" onClick={() => setMute(true)}><Icon n="bedtime" size={20} /></button>
            <button className="icon-btn ghost sm" aria-label="Yopish" onClick={toggleOpen}><Icon n="close" size={20} /></button>
          </div>
          <div className="foogi-msgs" ref={msgRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`foogi-m from-${m.from}`}>
                <span className="foogi-mt">{m.text}</span>
                {m.href && <Link href={m.href} className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>{m.label || 'Ochish'}<Icon n="arrow_forward" size={16} /></Link>}
                {!!m.sug?.length && <div className="row wrap" style={{ gap: 6 }}>{m.sug.map((s) => <button key={s.answerId} className="chip" onClick={() => ask(s.title, s.answerId)}>{s.title}</button>)}</div>}
                {m.from === 'foogi' && m.id && m.matched && !m.voted && (
                  <span className="row c3" style={{ gap: 4, fontSize: 12 }}>Foydali bo‘ldimi?
                    <button className="icon-btn ghost sm" aria-label="Ha, foydali" onClick={() => vote(i, true)}><Icon n="thumb_up" size={16} /></button>
                    <button className="icon-btn ghost sm" aria-label="Yo‘q" onClick={() => vote(i, false)}><Icon n="thumb_down" size={16} /></button>
                  </span>
                )}
              </div>
            ))}
            {typing && <span className="foogi-m"><span className="foogi-mt mono c2">FOOGI yozmoqda…</span></span>}
          </div>
          <div className="foogi-chips">{chips.map((c) => <button key={c.t} className="chip" onClick={c.fn}>{c.t}</button>)}</div>
          <form className="foogi-input" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="FOOGI’dan so‘rang…" aria-label="Xabar" maxLength={300} />
            <button className={`icon-btn ${draft.trim() ? 'primary' : ''}`} aria-label="Yuborish" disabled={!draft.trim() || typing}><Icon n="send" size={20} /></button>
          </form>
        </div>
      )}
    </div>
  );
}
