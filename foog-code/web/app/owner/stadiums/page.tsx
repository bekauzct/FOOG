'use client';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Btn, Icon, Loading, Modal, Toggle } from '@/components/ui';
import { OwnerHeader, stadiumStatus, useOwner, type OwnerStadium } from '@/components/owner';
import { del, patch, post, put, upload } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { AMENITY, DISTRICTS, SIZE_LABEL, SURFACE_LABEL, dec, sum } from '@/lib/format';

const PickMap = dynamic(() => import('@/components/PickMap'), { ssr: false, loading: () => <div className="skel" style={{ height: 240, borderRadius: 14 }} /> });
type Pitch = OwnerStadium['pitches'][0] & { id?: string };
type Form = { name: string; address: string; district: string; lat: number; lng: number; phone: string; description: string; metro: string; amenities: string[]; cancelPolicy: string; pitches: Pitch[] };
const POLICIES = ['24 soat oldin bepul bekor qilish', 'O‘yindan 3 soat oldingacha bepul bekor qilish', 'O‘yindan 12 soat oldingacha bepul bekor qilish', 'Bekor qilishda stadion bilan kelishiladi'];
const blank = (): Form => ({ name: '', address: '', district: 'Yunusobod', lat: 41.3111, lng: 69.2797, phone: '', description: '', metro: '', amenities: ['changing', 'lights'], cancelPolicy: POLICIES[0], pitches: [] });
const toForm = (s: OwnerStadium): Form => ({ name: s.name, address: s.address, district: s.district, lat: s.lat, lng: s.lng, phone: s.phone ?? '', description: s.description ?? '', metro: s.metro ?? '', amenities: s.amenities, cancelPolicy: s.cancelPolicy, pitches: s.pitches });

function PitchModal({ p, onClose, onSave }: { p: Pitch | null; onClose: () => void; onSave: (p: Pitch) => void }) {
  const [f, setF] = useState<Pitch | null>(p);
  useEffect(() => setF(p), [p]);
  if (!f) return null;
  const ok = f.name.trim() && f.price >= 10000 && f.peakPrice >= 10000;
  return (
    <Modal open onClose={onClose} title={p?.id ? 'Maydonni tahrirlash' : 'Yangi maydon'}>
      <label className="field"><span>Nomi</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Maydon A" /></label>
      <div className="field"><span>O‘lcham</span><div className="row" style={{ gap: 8 }}>{['5x5', '7x7', '11x11'].map((k) => <button key={k} className={`chip ${f.size === k ? 'on' : ''}`} onClick={() => setF({ ...f, size: k })}>{SIZE_LABEL[k]}</button>)}</div></div>
      <div className="field"><span>Qoplama</span><div className="row wrap" style={{ gap: 8 }}>{Object.entries(SURFACE_LABEL).map(([k, v]) => <button key={k} className={`chip ${f.surface === k ? 'on' : ''}`} onClick={() => setF({ ...f, surface: k })}>{v}</button>)}</div></div>
      <div className="row between"><span style={{ fontWeight: 600, fontSize: 14 }}>Yopiq (tomli)</span><Toggle on={f.indoor} onChange={(v) => setF({ ...f, indoor: v })} label="Yopiq" /></div>
      <div className="row" style={{ gap: 10 }}>
        <label className="field grow"><span>Narx / soat</span><input className="input mono" inputMode="numeric" value={f.price || ''} onChange={(e) => setF({ ...f, price: Number(e.target.value.replace(/\D/g, '')) })} /><span className="hint">{sum(f.price || 0)}</span></label>
        <label className="field grow"><span>Peak narx</span><input className="input mono" inputMode="numeric" value={f.peakPrice || ''} onChange={(e) => setF({ ...f, peakPrice: Number(e.target.value.replace(/\D/g, '')) })} /><span className="hint">{sum(f.peakPrice || 0)}</span></label>
      </div>
      <label className="field"><span>Peak boshlanishi</span><select className="select" value={f.peakFrom} onChange={(e) => setF({ ...f, peakFrom: +e.target.value })}>{Array.from({ length: 10 }, (_, i) => 14 + i).map((h) => <option key={h} value={h}>{h}:00 dan</option>)}</select></label>
      <label className="field"><span>Izoh (ixtiyoriy)</span><input className="input" value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Kafe yonida · 40×20 m" maxLength={80} /></label>
      <Btn className="btn btn-primary btn-block" disabled={!ok} onClick={() => onSave(f)}>Saqlash</Btn>
    </Modal>
  );
}

function Editor({ st, isNew, onDone }: { st: OwnerStadium | null; isNew: boolean; onDone: (id?: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState<Form>(st && !isNew ? toForm(st) : blank());
  const [dirty, setDirty] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [pitchIdx, setPitchIdx] = useState<number | null>(null);
  const [accept, setAccept] = useState(st?.accepting ?? true);
  const [photos, setPhotos] = useState(st?.photos ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { setF(st && !isNew ? toForm(st) : blank()); setDirty(isNew); setAccept(st?.accepting ?? true); setPhotos(st?.photos ?? []); setNewFiles([]); setErr(null); }, [st?.id, isNew]);
  const set = (p: Partial<Form>) => { setF((x) => ({ ...x, ...p })); setDirty(true); };
  const savePitch = (p: Pitch) => { const ps = [...f.pitches]; if (pitchIdx === null) ps.push(p); else ps[pitchIdx] = p; set({ pitches: ps }); setPitch(null); setPitchIdx(null); };
  const save = async () => {
    setErr(null);
    if (f.name.trim().length < 3) return setErr('Stadion nomini kiriting');
    if (f.address.trim().length < 5) return setErr('Manzilni kiriting');
    if (!f.pitches.length) return setErr('Kamida bitta maydon qo‘shing');
    setBusy(true);
    const body = { ...f, phone: f.phone || null, description: f.description || null, metro: f.metro || null, pitches: f.pitches.map((p) => ({ id: p.id, name: p.name, size: p.size, surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peakPrice, peakFrom: p.peakFrom, note: p.note || null })) };
    try {
      let id = st?.id;
      if (isNew) id = (await post<{ id: string }>('/stadiums', body)).id;
      else await put(`/stadiums/${id}`, body);
      if (newFiles.length && id) { const d = new FormData(); newFiles.forEach((x) => d.append('photos', x)); await upload(`/stadiums/${id}/photos`, d); }
      toast(isNew ? 'Ariza yuborildi · admin tekshiruvidan so‘ng saytda ko‘rinadi' : 'O‘zgarishlar saqlandi');
      setDirty(false); setNewFiles([]);
      onDone(id);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const removePhoto = async (pid: string) => {
    if (!st) return;
    try { await del(`/stadiums/${st.id}/photos/${pid}`); setPhotos((p) => p.filter((x) => x.id !== pid)); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const toggleAccept = async (v: boolean) => {
    if (!st) return;
    setAccept(v);
    try { await patch(`/stadiums/${st.id}/accepting`, { accepting: v }); toast(v ? 'Bron qabul qilish yoqildi' : 'Yangi bronlar vaqtincha yopildi', { kind: v ? 'ok' : 'warn' }); onDone(st.id); } catch (e) { setAccept(!v); toast((e as Error).message, { kind: 'err' }); }
  };
  const resubmit = async () => {
    if (!st) return;
    try { await post(`/stadiums/${st.id}/resubmit`); toast('Ariza qayta yuborildi'); onDone(st.id); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const allPhotos = [...photos.map((p) => ({ key: p.id, url: p.url, saved: true })), ...newFiles.map((x, i) => ({ key: `n${i}`, url: URL.createObjectURL(x), saved: false }))];
  return (
    <div className="card col" style={{ padding: 24, gap: 20, minWidth: 0 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div className="col"><span className="label-sm">{isNew ? 'Yangi stadion' : 'Tahrirlash'}</span><h2 className="t-h3">{isNew ? 'Stadion qo‘shish' : st?.name}</h2></div>
        {!isNew && st?.status === 'live' && <div className="row" style={{ gap: 10 }}><b style={{ fontSize: 14 }}>Bron qabul qilish</b><Toggle on={accept} onChange={toggleAccept} label="Bron qabul qilish" /></div>}
      </div>
      {!isNew && st?.status === 'rejected' && (
        <div className="row wrap" style={{ gap: 10, padding: 14, borderRadius: 14, background: 'color-mix(in oklch,var(--error) 12%,transparent)' }}>
          <Icon n="report" style={{ color: 'var(--error)' }} /><span className="grow t-small">Ariza rad etildi: <b>{st.rejectReason}</b>. Tuzatib saqlang va qayta yuboring.</span>
          <button className="btn btn-primary btn-sm" onClick={resubmit} disabled={dirty}>Qayta yuborish</button>
        </div>
      )}
      {!isNew && st?.status === 'mod' && <div className="row" style={{ gap: 10, padding: 14, borderRadius: 14, background: 'color-mix(in oklch,var(--warning) 12%,transparent)' }}><Icon n="hourglass_top" style={{ color: 'var(--warning)' }} /><span className="t-small">Moderatsiyada. Admin rasmlar, manzil va narxlarni tekshiradi – natija Telegramga keladi.</span></div>}

      <div className="os-photos">
        {allPhotos.slice(0, 4).map((p, i) => (
          <div key={p.key} className={`ph ${i === 0 ? 'os-main' : ''}`} style={{ position: 'relative', borderRadius: 14, background: `center/cover url("${p.url}")` }}>
            {p.saved ? <button className="icon-btn sm" style={{ position: 'absolute', top: 8, right: 8 }} onClick={() => removePhoto(p.key)} aria-label="Rasmni o‘chirish"><Icon n="delete" size={18} /></button> : <span className="pill-tag warning" style={{ position: 'absolute', top: 8, left: 8 }}>Saqlanmagan</span>}
          </div>
        ))}
        <button onClick={() => file.current?.click()} className="col" style={{ alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-2)', minHeight: 88 }}>
          <Icon n="add_photo_alternate" /><span style={{ fontSize: 13, fontWeight: 600 }}>Rasm{allPhotos.length > 4 ? ` · +${allPhotos.length - 4}` : ''}</span>
        </button>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { setNewFiles((x) => [...x, ...Array.from(e.target.files ?? [])]); setDirty(true); e.target.value = ''; }} />
      </div>
      <span className="c3 t-cap">Kamida 5 ta haqiqiy rasm – moderatsiya talabi. JPG/PNG, 10 MB gacha.</span>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <label className="field"><span>Stadion nomi</span><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="field"><span>Manzil</span><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Toshkent, … ko‘chasi 12" /></label>
        <label className="field"><span>Telefon (mijozlar uchun)</span><input className="input mono" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+998 90 123 45 67" /></label>
        <label className="field"><span>Tuman</span><select className="select" value={f.district} onChange={(e) => set({ district: e.target.value })}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="field"><span>Metro (ixtiyoriy)</span><input className="input" value={f.metro} onChange={(e) => set({ metro: e.target.value })} /></label>
        <label className="field"><span>Bekor qilish</span><select className="select" value={f.cancelPolicy} onChange={(e) => set({ cancelPolicy: e.target.value })}>{[...new Set([f.cancelPolicy, ...POLICIES])].map((p) => <option key={p}>{p}</option>)}</select></label>
      </div>
      <label className="field"><span>Tavsif</span><textarea className="textarea" value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={1000} placeholder="Qoplama, yoritish, kiyinish xonalari…" /></label>
      <div className="field"><span>Xaritada joylashuv – bosib belgilang</span><div style={{ height: 240, borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--border)' }}><PickMap lat={f.lat} lng={f.lng} onPick={(lat, lng) => set({ lat, lng })} /></div><span className="hint mono">{dec(f.lat, 5)}, {dec(f.lng, 5)}</span></div>

      <div className="col" style={{ gap: 10 }}>
        <div className="row between"><span className="t-card">Maydonlar</span><button className="btn btn-outline btn-sm" onClick={() => { setPitchIdx(null); setPitch({ name: `Maydon ${String.fromCharCode(65 + f.pitches.length)}`, size: '5x5', surface: 'turf', indoor: false, price: 250000, peakPrice: 300000, peakFrom: 18, note: '' } as Pitch); }}><Icon n="add" size={18} />Maydon</button></div>
        {!f.pitches.length && <div className="well c2 t-small" style={{ padding: 14 }}>Hali maydon yo‘q. Har bir maydon uchun o‘lcham, qoplama va narxni kiriting.</div>}
        {f.pitches.map((p, i) => (
          <div key={p.id ?? i} className="row wrap" style={{ gap: 12, padding: '14px 16px', borderRadius: 14, background: 'var(--bg)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            <div className="col grow" style={{ minWidth: 140 }}><b style={{ fontSize: 15 }}>{p.name}</b><span className="c2" style={{ fontSize: 12 }}>{SIZE_LABEL[p.size]} · {SURFACE_LABEL[p.surface].toLowerCase()} · {p.indoor ? 'yopiq' : 'ochiq'}</span></div>
            <div className="col" style={{ alignItems: 'flex-end' }}><span className="mono" style={{ fontSize: 14 }}>{sum(p.price)}</span><span className="c3" style={{ fontSize: 11 }}>soatiga</span></div>
            <div className="col" style={{ alignItems: 'flex-end' }}><span className="mono ink" style={{ fontSize: 14 }}>{sum(p.peakPrice)}</span><span className="c3" style={{ fontSize: 11 }}>peak {p.peakFrom}–23</span></div>
            <button className="icon-btn ghost sm" onClick={() => { setPitchIdx(i); setPitch(p); }} aria-label="Tahrirlash"><Icon n="edit" size={20} /></button>
            <button className="icon-btn ghost sm" onClick={() => set({ pitches: f.pitches.filter((_, k) => k !== i) })} aria-label="O‘chirish"><Icon n="delete" size={20} style={{ color: 'var(--error)' }} /></button>
          </div>
        ))}
      </div>

      <div className="col" style={{ gap: 10 }}>
        <span className="t-card">Qulayliklar</span>
        <div className="row wrap" style={{ gap: 8 }}>{Object.entries(AMENITY).map(([k, [ic, l]]) => <button key={k} className={`chip ${f.amenities.includes(k) ? 'on' : ''}`} onClick={() => set({ amenities: f.amenities.includes(k) ? f.amenities.filter((x) => x !== k) : [...f.amenities, k] })}><Icon n={ic} size={18} />{l}</button>)}</div>
      </div>
      {err && <div role="alert" className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 14 }}><Icon n="error" size={20} />{err}</div>}
      <div className="row" style={{ gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost" disabled={!dirty || busy} onClick={() => (isNew ? onDone() : (setF(toForm(st!)), setDirty(false), setNewFiles([])))}>Bekor qilish</button>
        <Btn className="btn btn-primary" disabled={!dirty} loading={busy} onClick={save}>{isNew ? 'Moderatsiyaga yuborish' : 'O‘zgarishlarni saqlash'}</Btn>
      </div>
      <PitchModal p={pitch} onClose={() => setPitch(null)} onSave={savePitch} />
    </div>
  );
}

function Inner() {
  const { stadiums, current, setCurrent, reload, loading } = useOwner();
  const sp = useSearchParams();
  const router = useRouter();
  const isNew = sp.get('new') === '1' || (!!stadiums && !stadiums.length);
  return (
    <>
      <OwnerHeader title="Stadionlarim" />
      {loading && !stadiums ? <Loading rows={3} /> : (
        <div className="ow-side">
          <div className="col" style={{ gap: 12 }}>
            {stadiums?.map((s) => {
              const [label, color] = stadiumStatus(s);
              const on = !isNew && current?.id === s.id;
              return (
                <button key={s.id} onClick={() => { setCurrent(s.id); router.replace('/owner/stadiums'); }} className="card" style={{ padding: 0, overflow: 'hidden', textAlign: 'left', color: 'var(--text-1)', boxShadow: on ? 'inset 0 0 0 2px var(--brand-ink)' : undefined, border: on ? '1px solid transparent' : undefined }}>
                  <div className="ph" style={{ height: 150, position: 'relative', background: s.photos[0] ? `center/cover url("${s.photos[0].url}")` : undefined }}>
                    <span className="mono" style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 999, background: 'var(--surface)', color, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}><span className="dot" />{label}</span>
                  </div>
                  <div style={{ padding: '12px 16px' }}><b style={{ fontSize: 16 }}>{s.name}</b><div className="c2" style={{ fontSize: 13 }}>{s.pitches.length} maydon · {s.district}{s.rating ? ` · ${dec(s.rating.avg)} ★` : ''}</div></div>
                </button>
              );
            })}
            <button onClick={() => router.push('/owner/stadiums?new=1')} className="col" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120, borderRadius: 20, border: '1.5px dashed var(--border-strong)', background: isNew ? 'var(--surface)' : 'transparent', color: 'var(--text-2)', fontWeight: 600 }}><Icon n="add" size={28} />Yangi stadion qo‘shish</button>
          </div>
          <Editor st={isNew ? null : current} isNew={isNew} onDone={(id) => { reload(); if (id) setCurrent(id); router.replace('/owner/stadiums'); }} />
        </div>
      )}
    </>
  );
}

export default function OwnerStadiums() {
  return <Suspense><Inner /></Suspense>;
}
