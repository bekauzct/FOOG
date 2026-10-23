import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const FPS = 30;
export const VOLT = '#C8F53A';
export const MIDNIGHT = '#0D1226';
export const BLUE = '#3D6BFF';
export const CHALK = '#F7F8F1';

// Qo‘shiq: 98.68 BPM, birinchi zarb 1.248 s. Kuchli zarblar: 15.3 s va 161.3 s.
export const BEAT = 60 / 98.684;
export const BEAT0 = 1.248;
export const DROP1 = 15.3;
export const DROP2 = 161.3;
export const s = (sec: number) => Math.round(sec * FPS);

/** Zarbga mos puls: zarb paytida 1, keyin tez so‘nadi */
export const beatPulse = (frame: number, k = 7) => {
  const t = frame / FPS - BEAT0;
  if (t < 0) return 0;
  const ph = (t % BEAT) / BEAT;
  return Math.exp(-k * ph);
};

/** Qo‘lda ushlangan kamera titrashi */
export const shake = (frame: number, amp = 1) => ({
  x: (Math.sin(frame * 0.13) * 6 + Math.sin(frame * 0.41 + 1) * 3 + Math.sin(frame * 1.7) * 0.8) * amp,
  y: (Math.cos(frame * 0.11) * 5 + Math.sin(frame * 0.37 + 2) * 3 + Math.cos(frame * 1.9) * 0.8) * amp,
  r: Math.sin(frame * 0.07) * 0.5 * amp,
});

export const st = (name: string) => staticFile(`st/${name}.png`);
export const img = (name: string) => staticFile(`img/${name}.jpg`);

/** Kadr: rasm + Ken Burns + fokus tortish */
export const Shot: React.FC<{ src: string; dur: number; from?: number; to?: number; pan?: [number, number]; focus?: boolean; pos?: string }> = ({ src, dur, from = 1.08, to = 1.2, pan = [0, -40], focus = true, pos = 'center' }) => {
  const f = useCurrentFrame();
  const p = Math.min(1, f / dur);
  const sc = interpolate(p, [0, 1], [from, to]);
  const blur = focus ? interpolate(f, [0, 10], [14, 0], { extrapolateRight: 'clamp' }) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: MIDNIGHT }}>
      <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: `scale(${sc}) translate(${pan[0] * p}px, ${pan[1] * p}px)`, filter: `blur(${blur}px) saturate(1.08)` }} />
    </div>
  );
};

/** FOOGII stikeri: prujina bilan chiqadi, yengil chayqaladi */
export const Foogii: React.FC<{ name: string; x: number; y: number; size: number; delay?: number; flip?: boolean; bob?: number; rot?: number; exit?: number }> = ({ name, x, y, size, delay = 0, flip, bob = 1, rot = 0, exit }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = spring({ frame: f - delay, fps, config: { damping: 11, stiffness: 160, mass: 0.7 } });
  const out = exit === undefined ? 0 : spring({ frame: f - exit, fps, config: { damping: 14, stiffness: 200 } });
  const sc = inn * (1 - out);
  const by = Math.sin((f - delay) * 0.12) * 10 * bob;
  const r = rot + Math.sin((f - delay) * 0.09) * 3 * bob;
  return (
    <Img src={st(name)} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, objectFit: 'contain', transform: `translateY(${by}px) rotate(${r}deg) scale(${sc}) ${flip ? 'scaleX(-1)' : ''}`, filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.45))' }} />
  );
};

/** Gap pufagi. whisper=true – pichirlash: kichik, kursiv, uzuq chiziqli */
export const Bubble: React.FC<{ text: string; x: number; y: number; delay?: number; whisper?: boolean; loud?: boolean; w?: number; tail?: 'left' | 'right' | 'none'; exit?: number }> = ({ text, x, y, delay = 0, whisper, loud, w = 560, tail = 'left', exit }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = spring({ frame: f - delay, fps, config: loud ? { damping: 7, stiffness: 260 } : { damping: 14, stiffness: 140 } });
  const out = exit === undefined ? 0 : interpolate(f, [exit, exit + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // pichirlashda harflar asta-sekin chiqadi
  const shown = whisper ? text.slice(0, Math.max(0, Math.floor((f - delay) * 1.1))) : text;
  const shakeL = loud ? Math.sin(f * 2.3) * 6 * Math.max(0, 1 - (f - delay) / 25) : 0;
  const bg = loud ? VOLT : whisper ? 'rgba(13,18,38,.78)' : CHALK;
  const fg = loud ? MIDNIGHT : whisper ? 'rgba(247,248,241,.92)' : MIDNIGHT;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, transform: `translate(${shakeL}px,0) scale(${inn * (1 - out)})`, transformOrigin: tail === 'right' ? '90% 100%' : '10% 100%', opacity: 1 - out }}>
      <div style={{ background: bg, color: fg, borderRadius: loud ? 44 : 36, padding: loud ? '26px 40px' : whisper ? '20px 30px' : '24px 34px', fontFamily: whisper ? 'JetBrains Mono' : 'Archivo', fontWeight: loud ? 900 : whisper ? 500 : 800, fontStyle: whisper ? 'italic' : 'normal', fontSize: loud ? 120 : whisper ? 38 : 50, lineHeight: 1.12, letterSpacing: loud ? '-0.03em' : whisper ? '0' : '-0.01em', border: whisper ? '3px dashed rgba(200,245,58,.6)' : 'none', boxShadow: '0 20px 50px rgba(0,0,0,.35)', textAlign: loud ? 'center' : 'left', backdropFilter: whisper ? 'blur(8px)' : undefined }}>
        {whisper && <div style={{ fontSize: 22, letterSpacing: '.18em', color: VOLT, fontStyle: 'normal', marginBottom: 8 }}>PICHIRLAB</div>}
        {shown}
        {whisper && shown.length < text.length && <span style={{ opacity: 0.6 }}>▌</span>}
      </div>
      {tail !== 'none' && (
        <div style={{ position: 'absolute', bottom: -26, [tail]: 70, width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `30px solid ${whisper ? 'rgba(13,18,38,.78)' : bg}` } as React.CSSProperties} />
      )}
    </div>
  );
};

/** Katta matn: zarbga mos chiqadi */
export const Title: React.FC<{ lines: string[]; y: number; delay?: number; size?: number; color?: string; accent?: number }> = ({ lines, y, delay = 0, size = 132, color = CHALK, accent = -1 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y }}>
      {lines.map((l, i) => {
        const sp = spring({ frame: f - delay - i * 5, fps, config: { damping: 13, stiffness: 170 } });
        return (
          <div key={i} style={{ overflow: 'hidden', lineHeight: 0.98 }}>
            <div style={{ fontFamily: 'Archivo', fontWeight: 900, fontSize: size, letterSpacing: '-0.04em', color: i === accent ? VOLT : color, transform: `translateY(${(1 - sp) * 110}%)`, textShadow: '0 6px 30px rgba(0,0,0,.4)' }}>{l}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Qo‘shiq so‘zlari / taglavha */
export const Caption: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f - delay, [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, bottom: 235, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ background: 'rgba(13,18,38,.72)', color: CHALK, fontFamily: 'Archivo', fontWeight: 700, fontSize: 44, padding: '14px 26px', borderRadius: 18, textAlign: 'center', lineHeight: 1.25 }}>{text}</div>
    </div>
  );
};

export const FoogMark: React.FC<{ width: number; ink?: string; primary?: string; accent?: string }> = ({ width, ink = CHALK, primary = VOLT, accent = BLUE }) => (
  <svg viewBox="0 0 482 120" width={width} height={(width * 120) / 482} style={{ display: 'block', overflow: 'visible' }}>
    <defs>
      <mask id="fg">
        <path d="M428 0 H480 V120 H428 A60 60 0 0 1 428 0 Z" fill="white" />
        <path d="M428 22 H458 V98 H428 A38 38 0 0 1 428 22 Z" fill="black" />
        <rect x="450" y="22" width="40" height="34" fill="black" />
        <rect x="440" y="56" width="40" height="22" fill="white" />
      </mask>
      <mask id="fo">
        <path d="M174 0 H229 V120 H174 A60 60 0 0 1 174 0 Z" fill="white" />
        <path d="M174 22 H207 V98 H174 A38 38 0 0 1 174 22 Z" fill="black" />
        <path d="M294 0 H239 V120 H294 A60 60 0 0 0 294 0 Z" fill="white" />
        <path d="M294 22 H261 V98 H294 A38 38 0 0 0 294 22 Z" fill="black" />
        <circle cx="234" cy="60" r="20" fill="black" />
      </mask>
    </defs>
    <path d="M0 120 V60 A60 60 0 0 1 60 0 H100 V22 H60 A38 38 0 0 0 22 60 V120 Z" fill={ink} />
    <rect x="22" y="56" width="54" height="22" fill={ink} />
    <rect x="360" y="0" width="122" height="120" fill={ink} mask="url(#fg)" />
    <rect x="110" y="0" width="250" height="120" fill={primary} mask="url(#fo)" />
    <circle cx="234" cy="60" r="11" fill={accent} />
  </svg>
);
