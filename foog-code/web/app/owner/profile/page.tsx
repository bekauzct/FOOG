'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Avatar, Btn, Empty, Icon, Loading, Modal } from '@/components/ui';
import { OwnerHeader, ReviewRow, useOwner, type ReviewT } from '@/components/owner';
import { useApi } from '@/lib/useApi';
import { del, post, put } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useSession } from '@/lib/session';
import { MONTHS, dec, num, phone } from '@/lib/format';

type Prof = {
  user: { id: string; name: string; username: string; phone: string | null; avatarUrl: string | null; verified: boolean; createdAt: string; role: string };
  profile: { company: string | null; stir: string | null; legalAddress: string | null; payMethods: string };
  staff: boolean;
  stats: { stadiums: number; pitches: number; rating: number | null; reviews: number; bookingsYear: number; year: string };
  stadiums: { id: string; name: string; district: string; status: string; photo: string | null; pitches: number; rating: { avg: number } | null }[];
};
type Staff = { stadium: { id: string; name: string }; items: { role: string; user: { id: string; name: string; username: string | null; phone: string | null; avatarUrl: string | null } }[] };
const ST: Record<string, [string, string]> = { live: ['Faol', 'var(--success)'], mod: ['Moderatsiyada', 'var(--warning)'], off: ['To‘xtatilgan', 'var(--error)'], rejected: ['Rad etilgan', 'var(--error)'] };

function EditBiz({ p, onClose, onDone }: { p: Prof | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState(p ? { name: p.user.name, company: p.profile.company ?? '', stir: p.profile.stir ?? '', legalAddress: p.profile.legalAddress ?? '', payMethods: p.profile.payMethods } : null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { refresh } = useSession();
  if (!p || !f) return null;
  const save = async () => {
    setBusy(true);
    try { await put('/owner/profile', { ...f, company: f.company || null, stir: f.stir || null, legalAddress: f.legalAddress || null }); toast('Profil saqlandi'); refresh(); onDone(); onClose(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Profilni tahrirlash">
      <label className="field"><span>Ism familiya</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field"><span>Kompaniya</span><input className="input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="«Arena Sport» MChJ" /></label>
      <label className="field"><span>STIR</span><input className="input mono" inputMode="numeric" value={f.stir} onChange={(e) => setF({ ...f, stir: e.target.value })} placeholder="305 123 456" /></label>
      <label className="field"><span>Yuridik manzil</span><input className="input" value={f.legalAddress} onChange={(e) => setF({ ...f, legalAddress: e.target.value })} /></label>
      <label className="field"><span>To‘lov usuli (stadionda)</span><input className="input" value={f.payMethods} onChange={(e) => setF({ ...f, payMethods: e.target.value })} /><span className="hint">Saytda onlayn to‘lov yo‘q – bu matn futbolchilarga ma’lumot uchun.</span></label>
      <Btn className="btn btn-primary btn-block" loading={busy} onClick={save}>Saqlash</Btn>
    </Modal>
  );
}

function StaffCard({ stadiumId, canEdit }: { stadiumId: string; canEdit: boolean }) {
  const q = useApi<Staff>(`/owner/staff?stadiumId=${stadiumId}`, [stadiumId]);
  const [add, setAdd] = useState(false);
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async () => {
    setBusy(true);
    try { await post('/owner/staff', { stadiumId, contact }); toast('Xodim qo‘shildi · unga Telegram orqali xabar ketdi'); setAdd(false); setContact(''); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const remove = async (uid: string) => { try { await del(`/owner/staff/${stadiumId}/${uid}`); toast('Xodim olib tashlandi'); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } };
  return (
    <div className="card col" id="staff" style={{ padding: 20, gap: 12 }}>
      <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>Xodimlar</span>{canEdit && <button className="btn btn-outline btn-sm" onClick={() => setAdd(true)}><Icon n="person_add" size={18} />Qo‘shish</button>}</div>
      <Async q={q} loading={<Loading rows={2} card={false} />}>
        {(d) => (
          <>
            {!d.items.length && <p className="c2 t-small">Hali xodim yo‘q. Administratorni qo‘shing – u bronlarni tasdiqlaydi va jadvalni boshqaradi.</p>}
            {d.items.map((s) => (
              <div key={s.user.id} className="row" style={{ gap: 12 }}>
                <Avatar name={s.user.name} url={s.user.avatarUrl} size={40} />
                <span className="col grow"><b style={{ fontSize: 15 }}>{s.user.name}</b><span className="c2" style={{ fontSize: 12 }}>Administrator · @{s.user.username}</span></span>
                {canEdit && <button className="icon-btn ghost sm" onClick={() => remove(s.user.id)} aria-label="Olib tashlash"><Icon n="person_remove" size={20} /></button>}
              </div>
            ))}
            <p className="c3" style={{ fontSize: 12, lineHeight: 1.5 }}>Administrator bronlarni tasdiqlay oladi va jadvalni boshqaradi. Hisobot va biznes ma’lumotlarini faqat siz ko‘rasiz.</p>
          </>
        )}
      </Async>
      <Modal open={add} onClose={() => setAdd(false)} title="Xodim qo‘shish">
        <p className="c2 t-small">Xodim avval FOOG ga Telegram orqali kirgan bo‘lishi kerak. Uning username yoki telefon raqamini kiriting.</p>
        <input className="input" autoFocus value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@username yoki +998 90 123 45 67" />
        <Btn className="btn btn-primary btn-block" disabled={contact.trim().length < 3} loading={busy} onClick={submit}>Qo‘shish</Btn>
      </Modal>
    </div>
  );
}

export default function OwnerProfile() {
  const q = useApi<Prof>('/owner/profile');
  const { current } = useOwner();
  const rev = useApi<{ rating: { avg: number; count: number } | null; items: ReviewT[] }>(current ? `/owner/reviews?stadiumId=${current.id}` : null, [current?.id]);
  const [edit, setEdit] = useState(false);
  return (
    <>
      <OwnerHeader title="Profil" />
      <Async q={q} loading={<Loading rows={3} />}>
        {(p) => {
          const owner = p.user.role === 'owner';
          const since = `${p.user.createdAt.slice(0, 4)}-yil ${MONTHS[Number(p.user.createdAt.slice(5, 7)) - 1]}dan`;
          return (
            <>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="ph" style={{ height: 180 }} />
                <div className="row wrap" style={{ gap: 20, padding: '0 28px 20px', marginTop: -50, alignItems: 'flex-end' }}>
                  <Avatar name={p.user.name} url={p.user.avatarUrl} size={112} ring="var(--primary)" />
                  <div className="col grow" style={{ gap: 6, minWidth: 200 }}>
                    <h2 className="row" style={{ gap: 8, fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{p.user.name}{p.user.verified && <Icon n="verified" fill style={{ color: 'var(--accent)' }} />}</h2>
                    <div className="row wrap" style={{ gap: 8 }}><span className="tag solid">{owner ? 'Stadion egasi' : 'Administrator'}</span><span className="c2 t-small">{p.stats.stadiums && owner ? 'FOOG hamkori' : 'Xodim'} · {since}</span></div>
                  </div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    {current && <Link href={`/stadiums/${current.id}`} className="btn btn-outline"><Icon n="visibility" size={20} />Ommaviy ko‘rinish</Link>}
                    {owner && <button className="btn btn-inverse" onClick={() => setEdit(true)}>Profilni tahrirlash</button>}
                  </div>
                </div>
                <div className="ow-kpis" style={{ gap: 0, borderTop: '1px solid var(--border)' }}>
                  {([[p.stats.stadiums, 'stadion', ''], [p.stats.pitches, 'maydon', ''], [p.stats.rating ? dec(p.stats.rating) : '—', `reyting · ${p.stats.reviews} sharh`, 'ink'], [num(p.stats.bookingsYear), `bron ${p.stats.year}-yilda`, '']] as const).map(([v, l, c], i) => (
                    <div key={l} className="col" style={{ padding: '18px 28px', borderLeft: i ? '1px solid var(--border)' : 'none' }}><span className={`mono ${c}`} style={{ fontSize: 26 }}>{v}</span><span className="c2 t-small">{l}</span></div>
                  ))}
                </div>
              </div>
              <div className="ow-two">
                <div className="col" style={{ gap: 20 }}>
                  <div className="card col" style={{ padding: 20, gap: 12 }}>
                    <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>Mening stadionlarim</span><Link href="/owner/stadiums" style={{ fontWeight: 600, fontSize: 14 }}>Boshqarish</Link></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
                      {p.stadiums.map((s) => (
                        <Link key={s.id} href="/owner/stadiums" className="row" style={{ gap: 12, padding: 12, borderRadius: 14, boxShadow: 'inset 0 0 0 1px var(--border)', color: 'var(--text-1)' }}>
                          <span className="ph" style={{ width: 60, height: 60, borderRadius: 10, flexShrink: 0, background: s.photo ? `center/cover url("${s.photo}")` : undefined }} />
                          <span className="col" style={{ minWidth: 0 }}><b className="ellipsis">{s.name}</b><span className="c2" style={{ fontSize: 12 }}>{s.pitches} maydon · {s.district}{s.rating ? ` · ${dec(s.rating.avg)} ★` : ''}</span><span className="row mono" style={{ gap: 6, fontSize: 12, color: ST[s.status][1] }}><span className="dot" />{ST[s.status][0]}</span></span>
                        </Link>
                      ))}
                      {!p.stadiums.length && <Empty icon="stadium" title="Stadion yo‘q" action={<Link href="/owner/stadiums?new=1" className="btn btn-primary btn-sm">Qo‘shish</Link>} />}
                    </div>
                  </div>
                  <div className="card col" style={{ padding: 20, gap: 4 }}>
                    <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>Sharhlar</span>{rev.data?.rating && <span className="mono c2" style={{ fontSize: 14 }}>{dec(rev.data.rating.avg)} · {rev.data.rating.count} ta</span>}</div>
                    {rev.loading && !rev.data ? <Loading rows={2} card={false} /> : !rev.data?.items.length ? <p className="c2 t-small">Hali sharh yo‘q.</p> : rev.data.items.slice(0, 3).map((r) => <ReviewRow key={r.id} r={r} onReplied={rev.reload} />)}
                    {(rev.data?.items.length ?? 0) > 3 && <Link href="/owner/reviews" style={{ fontWeight: 600, fontSize: 14, paddingTop: 10 }}>Barcha sharhlar</Link>}
                  </div>
                </div>
                <div className="col" style={{ gap: 20 }}>
                  {owner && (
                    <div className="card col" style={{ padding: 20, gap: 4 }}>
                      <span className="t-card" style={{ fontSize: 18, paddingBottom: 8 }}>Biznes ma’lumotlari</span>
                      {([['business', 'Kompaniya', p.profile.company], ['badge', 'STIR', p.profile.stir], ['send', 'Telegram', p.user.username ? `@${p.user.username}` : null], ['call', 'Telefon', phone(p.user.phone)], ['location_on', 'Yuridik manzil', p.profile.legalAddress], ['storefront', 'To‘lov usuli', p.profile.payMethods]] as const).map(([ic, l, v]) => (
                        <div key={l} className="row" style={{ gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' }}><Icon n={ic} size={20} style={{ color: 'var(--text-2)' }} /><span className="col"><span className="c2" style={{ fontSize: 12 }}>{l}</span><b style={{ fontSize: 14, fontWeight: 600 }}>{v || '—'}</b></span></div>
                      ))}
                    </div>
                  )}
                  {current && <StaffCard stadiumId={current.id} canEdit={owner} />}
                </div>
              </div>
              <EditBiz p={edit ? p : null} onClose={() => setEdit(false)} onDone={q.reload} />
            </>
          );
        }}
      </Async>
    </>
  );
}
