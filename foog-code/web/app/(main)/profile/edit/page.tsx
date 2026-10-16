'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Btn, Icon, Loading } from '@/components/ui';
import { upload } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { AVAIL_LABEL, DISTRICTS, FOOT_LABEL, POS_LABEL, SKILL_LABEL } from '@/lib/format';

export default function EditProfile() {
  const { me, refresh } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ name: '', username: '', bio: '', position: '', foot: '', district: '', skill: '', jersey: '', available: [] as string[] });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (me) setF({ name: me.name, username: me.username ?? '', bio: me.bio ?? '', position: me.position ?? '', foot: me.foot ?? '', district: me.district ?? '', skill: me.skill ?? '', jersey: me.jersey ? String(me.jersey) : '', available: me.available });
  }, [me?.id]);
  if (!me) return <div className="page-narrow"><Loading /></div>;
  const save = async () => {
    setBusy(true);
    setErr(null);
    const d = new FormData();
    for (const [k, v] of Object.entries(f)) if (k !== 'available' && v !== '') d.set(k, String(v));
    d.set('available', f.available.join(','));
    if (avatar) d.set('avatar', avatar);
    if (cover) d.set('cover', cover);
    try { await upload('/users/me', d, 'PUT'); await refresh(); toast('Profil saqlandi'); router.push('/profile'); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="page-narrow col" style={{ gap: 20 }}>
      <h1 className="t-page">Profilni tahrirlash</h1>
      <div className="card col" style={{ padding: 24, gap: 18 }}>
        <div className="row wrap" style={{ gap: 16 }}>
          <Avatar name={f.name} url={avatar ? URL.createObjectURL(avatar) : me.avatarUrl} size={80} />
          <div className="col" style={{ gap: 8 }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}><Icon n="photo_camera" size={18} />Rasmni almashtirish<input type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} /></label>
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><Icon n="wallpaper" size={18} />{cover ? cover.name : 'Muqova rasmi'}<input type="file" accept="image/*" hidden onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></label>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          <label className="field"><span>Ism</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field"><span>Username</span><input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></label>
          <label className="field"><span>Pozitsiya</span><select className="select" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Tanlang</option>{Object.entries(POS_LABEL).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select></label>
          <label className="field"><span>Oyoq</span><select className="select" value={f.foot} onChange={(e) => setF({ ...f, foot: e.target.value })}><option value="">Tanlang</option>{Object.entries(FOOT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>Tuman</span><select className="select" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="field"><span>Daraja</span><select className="select" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })}><option value="">Tanlang</option>{['beginner', 'intermediate', 'advanced'].map((k) => <option key={k} value={k}>{SKILL_LABEL[k]}</option>)}</select></label>
          <label className="field"><span>Futbolka raqami</span><input className="input" inputMode="numeric" value={f.jersey} onChange={(e) => setF({ ...f, jersey: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></label>
        </div>
        <label className="field"><span>O‘zingiz haqingizda</span><textarea className="textarea" maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Qaysi pozitsiyada, qachon va qayerda o‘ynaysiz?" /></label>
        <div className="field"><span>Bo‘sh vaqtim</span><div className="row wrap" style={{ gap: 8 }}>{Object.entries(AVAIL_LABEL).map(([k, v]) => <button key={k} className={`chip ${f.available.includes(k) ? 'on' : ''}`} onClick={() => setF({ ...f, available: f.available.includes(k) ? f.available.filter((x) => x !== k) : [...f.available, k] })}>{v}</button>)}</div></div>
        {err && <div role="alert" style={{ color: 'var(--error)', fontSize: 14 }}>{err}</div>}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => router.back()}>Bekor qilish</button><Btn className="btn btn-primary" loading={busy} onClick={save}>Saqlash</Btn></div>
      </div>
    </div>
  );
}
