'use client';
import { useEffect, useRef, useState } from 'react';
import { Btn, Icon, Modal, Toggle } from './ui';
import { get, upload, post } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useEvent, useSession } from '@/lib/session';

export const REEL_TYPES = ['O‘yin lavhasi', 'Gol', 'Seyv', 'Skill', 'Challenge', 'Stadion sharhi', 'Turnir', 'Aksiya'];

/** Reel joylash: video → izoh va tur → yuklash (processing) → qayta ishlash → published */
export function ReelUpload({ open, onClose, onPublished, owner }: { open: boolean; onClose: () => void; onPublished?: () => void; owner?: { stadiumId: string; stadiumName: string } | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [type, setType] = useState(owner ? 'Stadion sharhi' : 'O‘yin lavhasi');
  const [stadiumId, setStadiumId] = useState(owner?.stadiumId ?? '');
  const [cta, setCta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [stadiums, setStadiums] = useState<{ id: string; name: string }[]>([]);
  const [dur, setDur] = useState<number | null>(null);
  const pending = useRef<string | null>(null);
  const toast = useToast();
  const { me } = useSession();
  useEffect(() => { if (open && !owner) get<{ items: { id: string; name: string }[] }>('/stadiums?limit=50').then((r) => setStadiums(r.items)).catch(() => undefined); }, [open]);
  useEvent('reel', (d: { id: string; status: string }) => {
    if (d.id !== pending.current) return;
    pending.current = null;
    setProgress('idle');
    if (d.status === 'published') { toast('Reel joylandi · profil va lentada ko‘rinadi'); onPublished?.(); }
    else toast('Yuklash xatosi', { kind: 'err', action: { label: 'Qayta urinish', fn: () => post(`/reels/${d.id}/retry`).then(() => { pending.current = d.id; setProgress('processing'); }).catch((e) => toast(e.message, { kind: 'err' })) } });
  });
  const preview = file ? URL.createObjectURL(file) : null;
  const tooLong = dur !== null && dur > 61;
  const submit = async () => {
    setErr(null);
    if (!file) return setErr('Video tanlang');
    if (tooLong) return setErr('Video 60 soniyadan uzun. Qisqaroq video tanlang.');
    if (caption.trim().length > 300) return setErr('Izoh 300 belgidan oshmasin');
    const f = new FormData();
    f.set('video', file); f.set('caption', caption.trim()); f.set('type', type);
    if (stadiumId) f.set('stadiumId', stadiumId);
    f.set('bookCta', String(!!owner && cta));
    setBusy(true); setProgress('uploading');
    try {
      const r = await upload<{ id: string }>('/reels', f);
      pending.current = r.id;
      setProgress('processing');
      toast('Video yuklandi · qayta ishlanmoqda');
      setFile(null); setCaption(''); setDur(null);
      onClose();
    } catch (e) { setErr((e as Error).message); setProgress('idle'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Reel joylash">
      {!file ? (
        <label className="col" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, aspectRatio: '16/10', borderRadius: 20, border: '1.5px dashed var(--border-strong)', cursor: 'pointer', color: 'var(--text-2)', textAlign: 'center', padding: 16 }}>
          <Icon n="video_call" size={40} /><b style={{ color: 'var(--text-1)' }}>Video tanlang</b><span className="t-small">9:16 · 60 soniyagacha · MP4, MOV, WEBM</span>
          <input type="file" accept="video/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <video src={preview!} muted playsInline controls onLoadedMetadata={(e) => setDur((e.target as HTMLVideoElement).duration)} style={{ width: 140, aspectRatio: '9/16', objectFit: 'cover', borderRadius: 14, background: '#000' }} />
          <div className="col grow" style={{ gap: 6, minWidth: 0 }}>
            <b className="ellipsis">{file.name}</b>
            <span className="mono c2" style={{ fontSize: 12 }}>{dur ? `0:${String(Math.round(dur)).padStart(2, '0')}` : '…'} · {(file.size / 1048576).toFixed(1).replace('.', ',')} MB</span>
            {tooLong && <span style={{ color: 'var(--error)', fontSize: 13 }}>60 soniyadan uzun</span>}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setFile(null); setDur(null); }}><Icon n="swap_horiz" size={18} />Almashtirish</button>
          </div>
        </div>
      )}
      <label className="field"><span>Izoh</span><textarea className="textarea" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="Nima bo‘ldi? #heshteglar qo‘shing" style={{ minHeight: 72 }} /><span className="hint">{caption.length} / 300</span></label>
      <div className="field"><span>Turi</span><div className="row wrap" style={{ gap: 8 }}>{(owner ? REEL_TYPES.slice(5) : REEL_TYPES.slice(0, 5)).map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{t}</button>)}</div></div>
      {!owner && me?.role !== 'owner' && (
        <label className="field"><span>Stadion (ixtiyoriy)</span><select className="select" value={stadiumId} onChange={(e) => setStadiumId(e.target.value)}><option value="">Tanlanmagan</option>{stadiums.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      )}
      {owner && <div className="row between" style={{ gap: 12 }}><span className="col"><b style={{ fontSize: 15 }}>«Bron qilish» tugmasi</b><span className="c2 t-cap">Reel ostida {owner.stadiumName} bron tugmasi chiqadi</span></span><Toggle on={cta} onChange={setCta} label="Bron tugmasi" /></div>}
      {err && <div role="alert" style={{ color: 'var(--error)', fontSize: 14 }}>{err}</div>}
      <Btn className="btn btn-primary btn-lg btn-block" loading={busy} disabled={!file || tooLong} onClick={submit}>{progress === 'uploading' ? 'Yuklanmoqda…' : 'Joylash'}</Btn>
      <span className="c3 t-cap" style={{ textAlign: 'center' }}>Video saytda ko‘rish formatiga o‘tkaziladi (720p). Tayyor bo‘lganda xabar beramiz.</span>
    </Modal>
  );
}
