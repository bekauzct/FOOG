import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CHALK, FPS, VOLT } from './lib';

const tc = (f: number) => {
  const t = f / FPS;
  const p = (n: number) => String(Math.floor(n)).padStart(2, '0');
  return `${p(t / 3600)}:${p((t / 60) % 60)}:${p(t % 60)}:${p(f % FPS)}`;
};

/** FOOGII kamerasining ekrani: burchaklar, REC, vaqt kodi, batareya */
export const Viewfinder: React.FC<{ selfie: boolean; zoom: number; label?: string; boot: number; saved: number }> = ({ selfie, zoom, label, boot, saved }) => {
  const f = useCurrentFrame();
  const on = interpolate(f, [boot, boot + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rec = Math.floor(f / 15) % 2 === 0;
  const off = interpolate(f, [saved, saved + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const o = on * off;
  const C = 64, L = 96, W = 6;
  const corner = (st: React.CSSProperties) => <div style={{ position: 'absolute', width: L * on, height: L * on, borderColor: CHALK, borderStyle: 'solid', borderWidth: 0, ...st }} />;
  const mono: React.CSSProperties = { fontFamily: 'JetBrains Mono', fontWeight: 700, color: CHALK, fontSize: 34, letterSpacing: '.04em', textShadow: '0 2px 10px rgba(0,0,0,.6)' };
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o, pointerEvents: 'none' }}>
      {/* uchdan bir to‘r */}
      {[1, 2].map((i) => <div key={'v' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / 3}%`, width: 2, background: 'rgba(255,255,255,.12)' }} />)}
      {[1, 2].map((i) => <div key={'h' + i} style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / 3}%`, height: 2, background: 'rgba(255,255,255,.12)' }} />)}
      {corner({ left: C, top: C + 60, borderLeftWidth: W, borderTopWidth: W, borderTopLeftRadius: 18 })}
      {corner({ right: C, top: C + 60, borderRightWidth: W, borderTopWidth: W, borderTopRightRadius: 18 })}
      {corner({ left: C, bottom: C + 150, borderLeftWidth: W, borderBottomWidth: W, borderBottomLeftRadius: 18 })}
      {corner({ right: C, bottom: C + 150, borderRightWidth: W, borderBottomWidth: W, borderBottomRightRadius: 18 })}
      {/* yuqori qator */}
      <div style={{ position: 'absolute', top: 70, left: 90, right: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, ...mono }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#FF3B30', opacity: rec ? 1 : 0.25, boxShadow: '0 0 18px #FF3B30' }} />REC
        </div>
        <div style={mono}>{tc(Math.max(0, f - boot))}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...mono }}>
          <span style={{ width: 62, height: 30, border: `4px solid ${CHALK}`, borderRadius: 7, padding: 3, display: 'flex' }}><span style={{ width: '78%', background: VOLT, borderRadius: 2 }} /></span>
        </div>
      </div>
      {/* pastki qator */}
      <div style={{ position: 'absolute', bottom: 150, left: 90, right: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ ...mono, fontSize: 30, color: VOLT }}>FOOGII CAM</div>
        <div style={{ ...mono, fontSize: 30, background: 'rgba(13,18,38,.55)', padding: '8px 18px', borderRadius: 40 }}>{selfie ? 'OLD KAMERA' : `${zoom.toFixed(1)}×`}</div>
        <div style={{ ...mono, fontSize: 30 }}>4K · 30</div>
      </div>
      {label && <div style={{ position: 'absolute', top: 140, left: 0, right: 0, textAlign: 'center', ...mono, fontSize: 28, color: VOLT }}>{label}</div>}
    </div>
  );
};
