'use client';
// FOOG × Sardorshtein – hamkorlik taklifi (dizayn: foog-sardorshtein.html, «Hamkorlik xati» bo‘limisiz)
import Link from 'next/link';
import type { CSSProperties } from 'react';
import FoogMark from './FoogMark';
import { Icon } from './ui';

const INK = '#0D1226', VOLT = '#C8F53A', CHALK = '#F7F8F1', BLUE = '#2E5BEA', LINE = '#D9DCD0', TEXT2 = '#4B5262';
const mono = "'JetBrains Mono', ui-monospace, monospace";
const kicker = (color: string): CSSProperties => ({ font: `500 12px ${mono}`, letterSpacing: '.14em', textTransform: 'uppercase', color });
const h2: CSSProperties = { margin: 0, fontSize: 'clamp(30px,4vw,44px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-.03em' };
const wrap: CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '64px 24px', display: 'flex', flexDirection: 'column', gap: 28 };

const FEATURES = [['stadium', 'Stadion bron', 'Yaqin maydon, bo‘sh soat, onlayn bron'], ['groups', 'O‘yin va jamoa', 'O‘yinchi topish, ochiq o‘yinga qo‘shilish'], ['trophy', 'Turnirlar', 'Hamma uchun, maktab turnirlari ham'], ['smart_display', 'Reels', 'Gol va lavhalarni ulashish'], ['badge', 'FOOG ID', 'Raqamli futbolchi kartasi']];
const WINS = [
  { t: 'Auditoriyangiz uchun', i: 'favorite', bg: '#151B33', fg: CHALK, ic: VOLT, items: ['Reklama emas – haqiqatan foydalanadigan xizmat', 'Futbol o‘ynash uchun hammasi bir joyda', 'Obunachilar o‘z FOOG ID’sini oladi'] },
  { t: 'Sardorshtein uchun', i: 'star', bg: VOLT, fg: INK, ic: INK, items: ['Shaxsiy FOOG ID kartasi va profil', 'Platformadagi futbolchilar orasida tanilish', 'Kelgan har bir mijozdan 50% daromad'] },
];
const HOW = ['Shaxsiy havola va promokod olasiz', 'Obunachilar u orqali FOOG’ga keladi', 'Ular bron qiladi, turnirga yoziladi', 'Har oy hisobot va to‘lov – 50%'];
const EXAMPLE: [string, string, boolean][] = [['Bron summasi', '300 000 so‘m', false], ['FOOG daromadi (12%)', '36 000 so‘m', false], ['Sizga (50%)', '18 000 so‘m', true]];

export default function PartnerSardor() {
  return (
    <div style={{ minHeight: '100vh', overflowX: 'clip', background: CHALK, color: INK, fontFamily: 'Archivo, system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      <style>{'@media (max-width: 520px) { .ps-wide { display: none } }'}</style>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(247,248,241,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E2E5DA' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 14, color: INK }} aria-label="FOOG">
            <span style={{ width: 92, display: 'block' }}><FoogMark ink={INK} primary={INK} accent="#3D6BFF" /></span>
            <span style={{ font: `500 13px ${mono}`, color: '#6F7583', whiteSpace: 'nowrap' }}>× Sardorshtein</span>
          </Link>
          <a href="https://t.me/FOOG_ads" aria-label="Telegram’da yozish" style={{ height: 40, padding: '0 16px', borderRadius: 999, background: INK, color: CHALK, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', flexShrink: 0 }}><Icon n="send" size={18} /><span className="ps-wide">Telegram’da yozish</span></a>
        </div>
      </header>

      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 1440 720" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          <circle cx="1080" cy="380" r="270" fill="none" stroke={INK} strokeOpacity="0.07" strokeWidth="2" />
          <line x1="1080" y1="0" x2="1080" y2="720" stroke={INK} strokeOpacity="0.07" strokeWidth="2" />
        </svg>
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '72px 24px 64px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 40, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 14px', borderRadius: 999, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${LINE}`, ...kicker('#4D6B00'), letterSpacing: '.12em' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: VOLT }} />Shaxsiy hamkorlik taklifi</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(44px,6vw,80px)', lineHeight: 0.98, fontWeight: 800, letterSpacing: '-.04em', textWrap: 'balance' } as CSSProperties}>Futbol auditoriyangiz uchun – haqiqiy foydali platforma</h1>
            <p style={{ margin: 0, fontSize: 19, lineHeight: 1.55, color: TEXT2, maxWidth: 540, textWrap: 'pretty' } as CSSProperties}>FOOG – Toshkentdagi futbolchilar uchun yagona joy. Sardorshtein obunachilariga qayerda, kim bilan va qachon o‘ynashni bir joyda beradi. Siz esa har bir kelgan mijozdan daromad olasiz.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="#shart" style={{ height: 52, padding: '0 26px', borderRadius: 999, background: VOLT, color: INK, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>50% ulush <Icon n="arrow_downward" size={20} /></a>
              <a href="https://t.me/FOOG_ads" style={{ height: 52, padding: '0 24px', borderRadius: 999, boxShadow: 'inset 0 0 0 1.5px #C3C7BB', color: INK, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center' }}>Telegram’da yozish</a>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
            <div style={{ position: 'absolute', width: 'min(360px, 80vw)', aspectRatio: '1', borderRadius: '50%', background: VOLT }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/foogi/foog_id.webp" alt="FOOGI" style={{ position: 'relative', width: 'min(100%,440px)', aspectRatio: '1', objectFit: 'contain', filter: 'drop-shadow(0 24px 30px rgba(13,18,38,.18))' }} />
            <span style={{ position: 'absolute', left: '4%', bottom: '14%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 18, background: '#FFFFFF', boxShadow: '0 12px 28px rgba(13,18,38,.12)', fontSize: 14, fontWeight: 700 }}><Icon n="badge" size={22} style={{ color: BLUE }} />Sardorshtein FOOG ID</span>
            <span style={{ position: 'absolute', right: '2%', top: '12%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 18, background: INK, color: CHALK, boxShadow: '0 12px 28px rgba(13,18,38,.2)', font: `600 15px ${mono}` }}>50% <span style={{ font: '600 13px Archivo', color: VOLT }}>har mijozdan</span></span>
          </div>
        </div>
      </section>

      <section style={{ ...wrap, padding: '24px 24px 56px', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={kicker('#4D6B00')}>FOOG nima</span><h2 style={h2}>Futbolchi uchun hammasi bir joyda – bepul</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 14 }}>
          {FEATURES.map(([i, t, s]) => (
            <div key={t} style={{ padding: 22, borderRadius: 22, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${LINE}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: CHALK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={i} size={26} style={{ color: BLUE }} /></span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{t}</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: TEXT2 }}>{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: INK, color: CHALK }}>
        <div style={wrap}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={kicker(VOLT)}>Nima uchun aynan siz</span><h2 style={h2}>Ikki tomonlama foyda</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 16 }}>
            {WINS.map((w) => (
              <div key={w.t} style={{ padding: 28, borderRadius: 24, background: w.bg, color: w.fg, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 800 }}><Icon n={w.i} size={30} />{w.t}</span>
                {w.items.map((it) => <span key={it} style={{ display: 'flex', gap: 12, fontSize: 16, lineHeight: 1.5 }}><Icon n="check" size={20} style={{ color: w.ic, flexShrink: 0, marginTop: 2 }} />{it}</span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="shart" style={wrap}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={kicker('#4D6B00')}>Moliyaviy shart</span><h2 style={h2}>Siz orqali kelgan har bir mijozdan – 50%</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16, alignItems: 'stretch' }}>
          <div style={{ padding: 32, borderRadius: 28, background: VOLT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20, minHeight: 260 }}>
            <span style={{ font: `600 13px ${mono}`, letterSpacing: '.12em' }}>SIZNING ULUSHINGIZ</span>
            <span style={{ font: `600 clamp(96px,12vw,150px) ${mono}`, lineHeight: 0.9, letterSpacing: '-.06em' }}>50%</span>
            <span style={{ fontSize: 17, lineHeight: 1.45, fontWeight: 600 }}>FOOG shu mijozlardan oladigan daromaddan</span>
          </div>
          <div style={{ padding: 28, borderRadius: 28, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${LINE}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Qanday ishlaydi</span>
            {HOW.map((t, i) => (
              <div key={t} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}><span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: INK, color: VOLT, font: `600 13px/30px ${mono}`, textAlign: 'center' }}>{i + 1}</span><span style={{ fontSize: 15, lineHeight: 1.5, paddingTop: 4 }}>{t}</span></div>
            ))}
          </div>
          <div style={{ padding: 28, borderRadius: 28, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${LINE}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Misol: stadion broni</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {EXAMPLE.map(([l, v, hi]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 14, background: hi ? '#F2F8DA' : CHALK }}><span style={{ fontSize: 14, color: hi ? INK : TEXT2 }}>{l}</span><span style={{ font: `600 15px ${mono}`, whiteSpace: 'nowrap' }}>{v}</span></div>
              ))}
            </div>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: '#6F7583' }}>Turnir badallari va boshqa pullik xizmatlarda ham shu tartib: FOOG daromadining yarmi sizga.</span>
          </div>
        </div>
      </section>

      <footer style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap', borderTop: '1px solid #E2E5DA' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, letterSpacing: '-.02em' }}>Birinchi hamkorlarimizdan bo‘ling</span><span style={{ fontSize: 16, color: TEXT2 }}>15 daqiqalik qo‘ng‘iroq – platformani ko‘rsatamiz.</span></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="https://t.me/FOOG_ads" style={{ height: 52, padding: '0 24px', borderRadius: 999, background: VOLT, color: INK, font: `600 15px ${mono}`, display: 'flex', alignItems: 'center', gap: 8 }}><Icon n="send" size={20} />@FOOG_ads</a>
          <a href="tel:+998937442254" style={{ height: 52, padding: '0 22px', borderRadius: 999, boxShadow: 'inset 0 0 0 1.5px #C3C7BB', color: INK, font: `600 15px ${mono}`, display: 'flex', alignItems: 'center', gap: 8 }}><Icon n="call" size={20} style={{ color: BLUE }} />+998 93 744 22 54</a>
        </div>
      </footer>
    </div>
  );
}
