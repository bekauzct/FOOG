'use client';
// Jonglyor Battle: video faqat sayt ichida kameradan yoziladi (galereyadan yuklash yo‘q).
// Kamera tasviri canvas’ga chiziladi va ustiga FOOG belgisi, server bergan bir martalik kod va soniya hisoblagichi
// yoziladi; yozuv shu canvas’dan olinadi. Server yozish vaqtini o‘zi o‘lchaydi va video uzunligi bilan solishtiradi.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Empty, Icon, Loading, Seg } from './ui';
import { post } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { DISTRICTS, num } from '@/lib/format';

export type JuggleMe = {
  best: number; total: number; approved: number; rank: number | null; todayLeft: number; daily: number; maxSec: number;
  record: { id: string; videoUrl: string | null; posterUrl: string | null } | null;
  items: { id: string; claimed: number; count: number | null; status: 'processing' | 'pending' | 'approved' | 'rejected' | 'failed'; videoUrl: string | null; posterUrl: string | null; rejectReason: string | null; createdAt: string }[];
};
export type JuggleUser = { best: number; total: number; approved: number; rank: number | null; record: { videoUrl: string | null; posterUrl: string | null } | null };
type Row = { rank: number; best: number; user: { id: string; name: string; username: string | null; avatarUrl: string | null; district: string | null } };

export const JUGGLE_STATUS: Record<JuggleMe['items'][number]['status'], [string, string]> = {
  processing: ['Video tayyorlanmoqda', 'muted'], pending: ['Tekshirilmoqda', 'warning'], approved: ['Tasdiqlandi', 'success'], rejected: ['Rad etildi', 'error'], failed: ['Qabul qilinmadi', 'error'],
};

/** Faqat telefonda: kompyuterdagi "virtual kamera" orqali tayyor videoni ko‘rsatish yo‘lini yopadi */
const isPhone = () => typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && matchMedia('(pointer: coarse)').matches;
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
};
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;

type Phase = 'rules' | 'camera' | 'starting' | 'recording' | 'review' | 'uploading' | 'done';

/** To‘liq ekranli yozish oynasi */
export function JuggleRecorder({ open, onClose, onDone, maxSec = 120 }: { open: boolean; onClose: () => void; onDone: () => void; maxSec?: number }) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('rules');
  const [err, setErr] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [ms, setMs] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [count, setCount] = useState('');
  const [progress, setProgress] = useState(0);
  const [code, setCode] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const token = useRef<string | null>(null);
  const t0 = useRef(0);
  const raf = useRef(0);
  const live = useRef({ code: '', recording: false });

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  const reset = useCallback(() => {
    stopCamera();
    if (rec.current && rec.current.state !== 'inactive') { rec.current.onstop = null; rec.current.stop(); }
    rec.current = null; chunks.current = []; blob.current = null; token.current = null; live.current = { code: '', recording: false };
    setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setMs(0); setCount(''); setProgress(0); setCode(''); setErr(null);
  }, [stopCamera]);
  useEffect(() => { if (!open) { reset(); setPhase('rules'); } }, [open, reset]);
  useEffect(() => () => reset(), [reset]);

  // Kamera tasvirini canvas’ga chizish + ustki yozuvlar (ular yozuvga ham tushadi)
  const draw = useCallback(() => {
    const v = video.current, c = canvas.current;
    if (v && c && v.videoWidth) {
      const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const g = c.getContext('2d')!;
      g.drawImage(v, 0, 0, w, h);
      const u = Math.max(12, Math.round(Math.min(w, h) / 22));
      g.font = `700 ${u}px ui-monospace, Menlo, monospace`;
      const elapsed = live.current.recording ? Date.now() - t0.current : 0;
      const lines = [`FOOG · ${live.current.code || '—'}`, `${mmss(elapsed)}  ${new Date().toLocaleTimeString('ru-RU', { hour12: false })}`];
      const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + u, bh = u * 2.9;
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(u * 0.6, h - bh - u * 0.6, bw, bh);
      g.fillStyle = '#C8F53A'; g.fillText(lines[0], u * 1.1, h - bh - u * 0.6 + u * 1.25);
      g.fillStyle = '#FFFFFF'; g.fillText(lines[1], u * 1.1, h - u * 1.15);
      if (live.current.recording) { g.fillStyle = '#FF2D2D'; g.beginPath(); g.arc(w - u * 1.6, u * 1.6, u * 0.55, 0, Math.PI * 2); g.fill(); }
      if (live.current.recording) setMs(elapsed);
    }
    raf.current = requestAnimationFrame(draw);
  }, []);

  const startCamera = useCallback(async (mode = facing) => {
    setErr(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia || pickMime() === null) { setErr('Bu brauzer kamerada yozishni qo‘llamaydi. Telefonda Chrome yoki Safari’da oching.'); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setPhase('camera');
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(draw);
    } catch (e) {
      const n = (e as Error).name;
      setErr(n === 'NotAllowedError' ? 'Kameraga ruxsat berilmadi. Brauzer sozlamalarida foog.uz uchun kamerani yoqing va qayta urinib ko‘ring.' : n === 'NotFoundError' ? 'Kamera topilmadi.' : 'Kamerani ochib bo‘lmadi. Telegram ichida ochgan bo‘lsangiz, saytni Chrome yoki Safari’da oching.');
    }
  }, [draw, facing, stopCamera]);

  const finish = useCallback(async () => {
    const r = rec.current;
    if (!r || r.state === 'inactive') return;
    live.current.recording = false;
    r.stop();
    if (token.current) post(`/juggle/${token.current}/stop`).catch(() => undefined);
  }, []);
  // Maksimal uzunlikda o‘zi to‘xtaydi
  useEffect(() => { if (phase === 'recording' && ms >= maxSec * 1000) void finish(); }, [ms, phase, maxSec, finish]);

  const start = async () => {
    setErr(null);
    setPhase('starting');
    try {
      const s = await post<{ token: string; code: string; maxSec: number }>('/juggle/start');
      token.current = s.token; live.current.code = s.code; setCode(s.code);
      const mime = pickMime() || undefined;
      const cs = canvas.current!.captureStream(30);
      const r = new MediaRecorder(cs, { mimeType: mime, videoBitsPerSecond: 2_000_000 });
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        const b = new Blob(chunks.current, { type: r.mimeType || mime || 'video/webm' });
        blob.current = b;
        setBlobUrl(URL.createObjectURL(b));
        stopCamera();
        setPhase('review');
      };
      t0.current = Date.now();
      live.current.recording = true;
      r.start(1000);
      rec.current = r;
      setPhase('recording');
    } catch (e) {
      setPhase('camera');
      setErr((e as Error).message);
    }
  };

  const submit = () => {
    const n = Number(count);
    if (!blob.current || !token.current || !Number.isInteger(n) || n < 1) return;
    setPhase('uploading'); setProgress(0); setErr(null);
    const fd = new FormData();
    fd.append('count', String(n));
    fd.append('video', blob.current, blob.current.type.includes('mp4') ? 'juggle.mp4' : 'juggle.webm');
    // Katta fayl: yuklash foizini ko‘rsatish uchun XHR
    const x = new XMLHttpRequest();
    x.open('POST', `/api/v1/juggle/${token.current}/submit`);
    x.withCredentials = true;
    x.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let d: { error?: string } = {};
      try { d = JSON.parse(x.responseText); } catch { /* bo‘sh */ }
      if (x.status >= 200 && x.status < 300) { setPhase('done'); onDone(); }
      else { setErr(d.error ?? 'Yuborib bo‘lmadi'); setPhase('review'); }
    };
    x.onerror = () => { setErr('Internet uzildi. Qayta yuboring.'); setPhase('review'); };
    x.send(fd);
  };

  const retake = () => { reset(); void startCamera(); };
  const flip = () => { const m = facing === 'environment' ? 'user' : 'environment'; setFacing(m); void startCamera(m); };
  const close = () => {
    if (phase === 'recording' || phase === 'uploading') return;
    if (phase === 'review' && !confirm('Yozilgan video yuborilmaydi. Chiqasizmi?')) return;
    onClose();
  };
  if (!open) return null;

  return (
    <div className="jg-overlay" role="dialog" aria-modal="true" aria-label="Jonglyor yozish">
      <div className="jg-top">
        <b>Jonglyor Battle</b>
        <button className="icon-btn" onClick={close} aria-label="Yopish" disabled={phase === 'recording' || phase === 'uploading'} style={{ color: '#fff' }}><Icon n="close" size={24} /></button>
      </div>

      {phase === 'rules' && (
        <div className="jg-body col" style={{ gap: 16, padding: 20, maxWidth: 520, margin: '0 auto', overflowY: 'auto' }}>
          <h2 className="t-h2" style={{ color: '#fff' }}>Qoidalar</h2>
          {([
            ['videocam', 'Video faqat shu yerda, kamera orqali yoziladi. Galereyadan yuklab bo‘lmaydi.'],
            ['accessibility_new', 'Telefonni qo‘yib qo‘ying: boshdan oyoqqacha butun tanangiz kadrda ko‘rinib tursin.'],
            ['sports_soccer', 'To‘p yerga tushsa – urinish tugadi. Har bir zarba = 1 ball.'],
            ['timer', `Bitta uzluksiz video, ko‘pi bilan ${Math.round(maxSec / 60)} daqiqa. Videoda kod va vaqt chiqadi – ularni yopmang.`],
            ['verified', 'Yozib bo‘lgach necha marta urganingizni o‘zingiz kiritasiz, moderator videoni ko‘rib tasdiqlaydi.'],
          ] as const).map(([ic, tx]) => <div key={ic} className="row" style={{ gap: 12, alignItems: 'flex-start', color: 'rgba(255,255,255,.88)', fontSize: 15, lineHeight: 1.5 }}><Icon n={ic} size={22} style={{ color: '#C8F53A', flexShrink: 0 }} />{tx}</div>)}
          {err && <div className="jg-err">{err}</div>}
          <Btn className="btn btn-primary btn-lg btn-block" onClick={() => startCamera()}><Icon n="videocam" size={20} />Kamerani yoqish</Btn>
        </div>
      )}

      <div className="jg-stage" style={{ display: phase === 'camera' || phase === 'starting' || phase === 'recording' ? 'flex' : 'none' }}>
        <video ref={video} playsInline muted style={{ display: 'none' }} />
        <canvas ref={canvas} className="jg-canvas" />
        {phase === 'recording' && <div className="jg-rec"><span className="dot" />{mmss(ms)} · {code}</div>}
      </div>
      {(phase === 'camera' || phase === 'starting' || phase === 'recording') && (
        <div className="jg-bar">
          {err && <div className="jg-err" style={{ width: '100%' }}>{err}</div>}
          <button className="icon-btn" style={{ color: '#fff', visibility: phase === 'recording' ? 'hidden' : 'visible' }} onClick={flip} aria-label="Kamerani almashtirish"><Icon n="cameraswitch" size={26} /></button>
          {phase === 'recording'
            ? <button className="jg-shutter on" onClick={finish} disabled={ms < 3000} aria-label="To‘xtatish"><span /></button>
            : <button className="jg-shutter" onClick={start} disabled={phase === 'starting'} aria-label="Yozishni boshlash"><span /></button>}
          <span style={{ width: 44 }} />
        </div>
      )}

      {(phase === 'review' || phase === 'uploading') && blobUrl && (
        <div className="jg-body col" style={{ gap: 14, padding: 16, maxWidth: 520, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
          <video src={blobUrl} controls playsInline style={{ width: '100%', maxHeight: '46vh', borderRadius: 14, background: '#000' }} />
          <label className="field" style={{ color: '#fff' }}><span style={{ color: 'rgba(255,255,255,.8)' }}>Necha marta urdingiz?</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={9999} value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Masalan: 23" style={{ fontSize: 22, height: 56, textAlign: 'center' }} disabled={phase === 'uploading'} />
          </label>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>Halol yozing: moderator videoni sanaydi. Son noto‘g‘ri bo‘lsa, tuzatiladi yoki urinish rad etiladi.</p>
          {err && <div className="jg-err">{err}</div>}
          {phase === 'uploading'
            ? <div className="col" style={{ gap: 8 }}><div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: '#C8F53A', transition: 'width .2s' }} /></div><span style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>Yuborilmoqda… {progress}%</span></div>
            : <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-outline" style={{ color: '#fff', flex: 1 }} onClick={retake}><Icon n="replay" size={20} />Qayta yozish</button>
              <Btn className="btn btn-primary" style={{ flex: 1.4 }} disabled={!(Number(count) >= 1)} onClick={submit}><Icon n="send" size={20} />Yuborish</Btn>
            </div>}
        </div>
      )}

      {phase === 'done' && (
        <div className="jg-body col" style={{ gap: 16, padding: 24, maxWidth: 460, margin: 'auto', alignItems: 'center', textAlign: 'center', color: '#fff' }}>
          <Icon n="check_circle" size={64} style={{ color: '#C8F53A' }} />
          <h2 className="t-h2" style={{ color: '#fff' }}>Yuborildi!</h2>
          <p style={{ color: 'rgba(255,255,255,.75)' }}>Moderator videoni ko‘rib chiqadi. Tasdiqlanganda ball FOOG ID’ingizga yoziladi va bildirishnoma keladi.</p>
          <button className="btn btn-primary btn-block" onClick={() => { toast('Urinish moderatsiyaga yuborildi'); onClose(); }}>Yaxshi</button>
        </div>
      )}
    </div>
  );
}

/** "Boshlash" tugmasi: kirish, telefon va kunlik limitni tekshiradi */
export function JuggleStart({ me, onDone, className = 'btn btn-primary btn-lg', label = 'Jonglyor yozish' }: { me: JuggleMe | null; onDone: () => void; className?: string; label?: string }) {
  const { me: user } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!user) return <Link href="/login?next=%2Fbattle" className={className}><Icon n="videocam" size={20} />{label}</Link>;
  const go = () => {
    if (!isPhone()) { toast('Jonglyor faqat telefonda yoziladi. foog.uz/battle ni telefoningizda oching.', { kind: 'warn' }); return; }
    if (me && me.todayLeft <= 0) { toast(`Bugungi ${me.daily} ta urinish tugadi. Ertaga yana urinib ko‘ring.`, { kind: 'warn' }); return; }
    setOpen(true);
  };
  return (
    <>
      <button className={className} onClick={go}><Icon n="videocam" size={20} />{label}</button>
      <JuggleRecorder open={open} onClose={() => setOpen(false)} onDone={onDone} maxSec={me?.maxSec} />
    </>
  );
}

/** Reyting jadvali: hamma vaqt / shu hafta, tuman bo‘yicha */
export function JuggleBoard({ compact, limit = 50 }: { compact?: boolean; limit?: number }) {
  const [period, setPeriod] = useState<'all' | 'week'>('all');
  const [district, setDistrict] = useState('');
  const q = useApi<{ items: Row[] }>(`/juggle/leaderboard?period=${period}&limit=${limit}${district ? `&district=${encodeURIComponent(district)}` : ''}`);
  return (
    <div className="col" style={{ gap: 12 }}>
      {!compact && (
        <div className="row between wrap" style={{ gap: 10 }}>
          <Seg value={period} onChange={setPeriod} items={[['all', 'Hamma vaqt'], ['week', 'Shu hafta']]} />
          <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="Tuman" style={{ height: 40, width: 'auto', minWidth: 180 }}>
            <option value="">Butun Toshkent</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}
      {!q.data ? <Loading rows={3} card={false} /> : !q.data.items.length ? <Empty icon="sports_soccer" title={period === 'week' ? 'Bu hafta hali tasdiqlangan natija yo‘q' : 'Hali hech kim natija qo‘ymagan'} text="Birinchi bo‘ling!" art={false} /> : (
        <div className="col" style={{ gap: 2 }}>
          {q.data.items.map((r) => (
            <Link key={r.user.id} href={r.user.username ? `/u/${r.user.username}` : '#'} className="row jg-row" style={{ gap: 12, color: 'var(--text-1)' }}>
              <span className={`jg-rank r${r.rank}`}>{r.rank <= 3 ? <Icon n="trophy" size={18} fill /> : r.rank}</span>
              <Avatar name={r.user.name} url={r.user.avatarUrl} size={36} />
              <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 15 }}>{r.user.name}</b><span className="c3 mono ellipsis" style={{ fontSize: 11 }}>@{r.user.username}{r.user.district ? ` · ${r.user.district}` : ''}</span></span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{num(r.best)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Profil (FOOG ID) uchun: rekord, jami ball, rekord videosi */
export function JuggleProfileCard({ username }: { username: string }) {
  const q = useApi<JuggleUser>(`/juggle/user/${encodeURIComponent(username)}`);
  const d = q.data;
  if (!d || !d.approved) return null;
  return (
    <div className="card col" style={{ padding: 20, gap: 14, alignSelf: 'start' }}>
      <div className="row between"><div className="row" style={{ gap: 10 }}><Icon n="swords" size={22} style={{ color: 'var(--brand-ink)' }} /><b>Jonglyor</b></div><Link href="/battle" className="label-sm c3">Battle</Link></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <div className="col"><span className="mono ink" style={{ fontSize: 24 }}>🏆 {num(d.best)}</span><span className="c2 t-cap">Rekord</span></div>
        <div className="col"><span className="mono" style={{ fontSize: 24 }}>{num(d.total)}</span><span className="c2 t-cap">Jami ball</span></div>
        <div className="col"><span className="mono" style={{ fontSize: 24 }}>{d.rank ? `#${d.rank}` : '—'}</span><span className="c2 t-cap">Reyting</span></div>
      </div>
      {d.record?.videoUrl && <video src={d.record.videoUrl} poster={d.record.posterUrl ?? undefined} controls playsInline preload="none" style={{ width: '100%', maxHeight: 360, borderRadius: 12, background: '#000' }} />}
    </div>
  );
}

/** Asosiy sahifa uchun qisqa karta */
export function JuggleHomeCard() {
  const { me: user } = useSession();
  const q = useApi<JuggleMe>(user ? '/juggle/me' : null);
  const d = q.data;
  return (
    <div className="card jg-card col" style={{ padding: 18, gap: 12 }}>
      <div className="row between"><div className="row" style={{ gap: 10 }}><Icon n="swords" size={22} /><b className="t-card">Jonglyor Battle</b></div><Link href="/battle" style={{ fontSize: 14, fontWeight: 600 }}>Reyting</Link></div>
      <p className="c2 t-small">To‘pni yerga tushirmasdan o‘ynating: 1 ta jonglyor = 1 ball. Natija FOOG ID’ingizga yoziladi.</p>
      {d && <div className="row" style={{ gap: 18 }}>
        <div><div className="mono" style={{ fontSize: 22 }}>{num(d.best)}</div><div className="c2" style={{ fontSize: 12 }}>Rekord</div></div>
        <div><div className="mono" style={{ fontSize: 22 }}>{num(d.total)}</div><div className="c2" style={{ fontSize: 12 }}>Jami ball</div></div>
        <div><div className="mono" style={{ fontSize: 22 }}>{d.rank ? `#${d.rank}` : '—'}</div><div className="c2" style={{ fontSize: 12 }}>O‘rin</div></div>
      </div>}
      <JuggleStart me={d} onDone={() => q.reload()} className="btn btn-primary btn-block" label={d?.best ? 'Rekordni yangilash' : 'Jonglyor yozish'} />
    </div>
  );
}
