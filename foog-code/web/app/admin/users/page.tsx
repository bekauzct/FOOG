'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Async, Avatar, Btn, Empty, Icon, Loading, Modal, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { del, get, patch, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { MONTHS_SHORT, dayMonthShort, phone, isoDate } from '@/lib/format';

type U = { id: string; name: string; username: string | null; phone: string | null; role: string; staff: boolean; district: string | null; createdAt: string; bookings: number; noShows: number; status: string; blockedUntil: string | null; blockReason: string | null; avatarUrl: string | null; obyektivka: boolean };
type Impact = { stadiums: number; stadiumBookings: number; teams: number; matches: number; bookings: number; posts: number; reels: number };
const ROLE: Record<string, string> = { player: 'Futbolchi', owner: 'Stadion egasi', admin: 'Administrator' };

function Inner() {
  const sp = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'player' | 'owner' | 'blocked' | 'noshow'>((sp.get('filter') as 'all') || 'all');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [dq, setDq] = useState(q);
  const [blocking, setBlocking] = useState<U | null>(null);
  const [days, setDays] = useState<number | null>(7);
  const [reason, setReason] = useState('Qoidabuzarlik');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<U | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const toast = useToast();
  const askDelete = (u: U) => { setDeleting(u); setImpact(null); setConfirmText(''); get<Impact>(`/admin/users/${u.id}/delete-impact`).then(setImpact).catch(() => setImpact(null)); };
  const confirmWord = deleting ? (deleting.username ?? 'ochirish') : '';
  const remove = async () => {
    if (!deleting) return;
    setBusy(deleting.id);
    try { await del(`/admin/users/${deleting.id}`); toast(`${deleting.name} butunlay o‘chirildi`, { kind: 'warn' }); setDeleting(null); r.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const r = useApi<{ items: U[] }>(`/admin/users${qs({ filter, q: dq })}`);
  const unblock = async (u: U) => {
    setBusy(u.id);
    try { await patch(`/admin/users/${u.id}`, { action: 'unblock' }); toast(`@${u.username} blokdan chiqarildi`); r.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  const block = async () => {
    if (!blocking) return;
    setBusy(blocking.id);
    try { await patch(`/admin/users/${blocking.id}`, { action: 'block', days: days ?? undefined, reason }); toast(`@${blocking.username} bloklandi · bronlar to‘xtatildi`, { kind: 'warn' }); setBlocking(null); r.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  return (
    <>
      <AdminHeader title="Foydalanuvchilar"><Link href="/admin/obyektivka" className="btn btn-outline btn-sm"><Icon n="description" size={18} />Obyektivka ma’lumotlari</Link></AdminHeader>
      <div className="row between wrap" style={{ gap: 12 }}>
        <Seg value={filter} onChange={setFilter} items={[['all', 'Hammasi'], ['player', 'Futbolchilar'], ['owner', 'Stadion egalari'], ['noshow', 'Ko‘p kelmaganlar'], ['blocked', 'Bloklangan']]} />
        <div className="search" style={{ height: 44, width: 'min(320px,100%)' }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, @username yoki telefon" aria-label="Qidirish" /></div>
      </div>
      <Async q={r} loading={<Loading rows={5} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="person_search" title="Foydalanuvchi topilmadi" /></div>}>
        {(d) => (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="ow-table">
              <thead><tr><th>Foydalanuvchi</th><th>Roli</th><th>Tuman</th><th>Bronlar</th><th>Kelmagan</th><th>Holat</th><th style={{ textAlign: 'right' }}>Amal</th></tr></thead>
              <tbody>
                {d.items.map((u) => {
                  const bl = u.status === 'blocked';
                  const j = isoDate(u.createdAt);
                  return (
                    <tr key={u.id}>
                      <td><div className="row" style={{ gap: 12 }}><Avatar name={u.name} url={u.avatarUrl} size={40} /><div className="col"><b style={{ fontSize: 15 }}>{u.name}</b><span className="mono c3" style={{ fontSize: 11 }}>@{u.username} · {j.slice(0, 4)}-{MONTHS_SHORT[Number(j.slice(5, 7)) - 1]}</span><span className="mono c3" style={{ fontSize: 11 }}>{phone(u.phone)}</span></div></div></td>
                      <td style={{ fontSize: 14 }}>{ROLE[u.role]}{u.staff ? ' · xodim' : ''}</td>
                      <td style={{ fontSize: 14 }}>{u.district ?? '—'}</td>
                      <td className="mono" style={{ fontSize: 14 }}>{u.bookings}</td>
                      <td className="mono" style={{ fontSize: 14, color: u.noShows >= 3 ? 'var(--error)' : undefined }}>{u.noShows}</td>
                      <td><span className={`pill-tag ${bl ? 'error' : 'success'}`}>{bl ? 'Bloklangan' : 'Faol'}</span>{bl && <div className="c3" style={{ fontSize: 11, marginTop: 4 }}>{u.blockReason}{u.blockedUntil ? ` · ${dayMonthShort(isoDate(u.blockedUntil))} gacha` : ' · muddatsiz'}</div>}</td>
                      <td style={{ textAlign: 'right' }}><div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>{u.obyektivka && <Link href={`/admin/obyektivka/${u.id}`} className="icon-btn" title="Obyektivka ma’lumotlari" aria-label="Obyektivka ma’lumotlari"><Icon n="description" size={20} /></Link>}{u.role !== 'admin' && (bl ? <Btn className="btn btn-outline btn-sm" loading={busy === u.id} onClick={() => unblock(u)}>Blokdan chiqarish</Btn> : <button className="btn btn-danger-outline btn-sm" onClick={() => { setBlocking(u); setDays(7); setReason(u.noShows >= 3 ? 'Ko‘p marta kelmagan' : 'Qoidabuzarlik'); }}>Bloklash</button>)}{u.role !== 'admin' && <button className="icon-btn" style={{ color: 'var(--error)' }} title="Butunlay o‘chirish" aria-label={`${u.name} ni butunlay o‘chirish`} onClick={() => askDelete(u)}><Icon n="delete" size={20} /></button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      <Modal open={!!blocking} onClose={() => setBlocking(null)} title={`@${blocking?.username} ni bloklash`}>
        <p className="c2 t-small">Bloklangan foydalanuvchi kira olmaydi, kutilayotgan bronlari bekor qilinadi.</p>
        <div className="field"><span>Muddat</span><div className="row wrap" style={{ gap: 8 }}>{([[1, '1 kun'], [7, '7 kun'], [30, '30 kun'], [null, 'Muddatsiz']] as const).map(([v, l]) => <button key={l} className={`chip ${days === v ? 'on' : ''}`} onClick={() => setDays(v)}>{l}</button>)}</div></div>
        <label className="field"><span>Sabab</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
        <Btn className="btn btn-danger btn-block" loading={busy === blocking?.id} onClick={block}>Bloklash</Btn>
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`${deleting?.name} ni butunlay o‘chirish`}>
        <p className="c2 t-small">Foydalanuvchi va unga tegishli hamma narsa bazadan o‘chiriladi: profil, bronlar, postlar, xabarlar, obyektivka ma’lumotlari. <b style={{ color: 'var(--error)' }}>Buni qaytarib bo‘lmaydi.</b> Shu telefon raqami bilan qayta kirsa, yangi hisob ochiladi.</p>
        {impact && (
          <div className="well col" style={{ padding: 14, gap: 4, fontSize: 14 }}>
            <span>Bronlari: <b>{impact.bookings}</b> · Postlari: <b>{impact.posts}</b> · Reels: <b>{impact.reels}</b></span>
            {(impact.teams > 0 || impact.matches > 0) && <span style={{ color: 'var(--warning)' }}>Sardor bo‘lgan jamoalari: <b>{impact.teams}</b> · tashkil qilgan o‘yinlari: <b>{impact.matches}</b> – ular ham o‘chadi</span>}
            {impact.stadiums > 0 && <span style={{ color: 'var(--error)' }}>Stadionlari: <b>{impact.stadiums}</b> – ular va boshqa futbolchilarning shu stadionlardagi <b>{impact.stadiumBookings}</b> ta broni ham o‘chadi</span>}
          </div>
        )}
        <label className="field"><span>Tasdiqlash uchun <b className="mono">{confirmWord}</b> deb yozing</span><input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></label>
        <Btn className="btn btn-danger btn-block" loading={busy === deleting?.id} disabled={confirmText.trim() !== confirmWord} onClick={remove}>Butunlay o‘chirish</Btn>
      </Modal>
    </>
  );
}

export default function AdminUsers() {
  return <Suspense><Inner /></Suspense>;
}
