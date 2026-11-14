'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Async, Avatar, Btn, Empty, Icon, Loading, Modal, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { patch, post, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useSession } from '@/lib/session';
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
  // O‘chirish: bitta (qatordagi savatcha) yoki belgilangan bir nechta foydalanuvchi
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<U[] | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const toast = useToast();
  const { me } = useSession();
  const askDelete = (list: U[]) => { setDeleting(list); setImpact(null); setConfirmText(''); post<Impact>('/admin/users/delete-impact', { ids: list.map((u) => u.id) }).then(setImpact).catch(() => setImpact(null)); };
  const confirmWord = !deleting ? '' : deleting.length === 1 ? (deleting[0].username ?? 'ochirish') : `${deleting.length} ta`;
  const remove = async () => {
    if (!deleting) return;
    setBusy('delete');
    try {
      await post('/admin/users/delete', { ids: deleting.map((u) => u.id) });
      toast(deleting.length === 1 ? `${deleting[0].name} butunlay o‘chirildi` : `${deleting.length} ta foydalanuvchi butunlay o‘chirildi`, { kind: 'warn' });
      setDeleting(null); setSel(new Set()); r.reload();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const r = useApi<{ items: U[] }>(`/admin/users${qs({ filter, q: dq })}`);
  // Belgilash faqat ko‘rinib turgan, o‘chirish mumkin bo‘lgan (admin emas) qatorlarga tegishli
  const deletable = (r.data?.items ?? []).filter((u) => u.role !== 'admin');
  const picked = deletable.filter((u) => sel.has(u.id));
  const allOn = deletable.length > 0 && picked.length === deletable.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  useEffect(() => { setSel(new Set()); }, [filter, dq]);
  const unblock = async (u: U) => {
    setBusy(u.id);
    try { await patch(`/admin/users/${u.id}`, { action: 'unblock' }); toast(`@${u.username} blokdan chiqarildi`); r.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  const [roleFor, setRoleFor] = useState<U | null>(null);
  const setAdmin = async () => {
    if (!roleFor) return;
    const admin = roleFor.role !== 'admin';
    setBusy('role');
    try { await patch(`/admin/users/${roleFor.id}/role`, { admin }); toast(admin ? `@${roleFor.username} endi administrator` : `@${roleFor.username} dan admin huquqi olindi`, { kind: admin ? undefined : 'warn' }); setRoleFor(null); r.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
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
              <thead><tr><th style={{ width: 44 }}><input type="checkbox" checked={allOn} disabled={!deletable.length} onChange={() => setSel(allOn ? new Set() : new Set(deletable.map((u) => u.id)))} aria-label="Hammasini belgilash" style={{ width: 18, height: 18, accentColor: 'var(--error)' }} /></th><th>Foydalanuvchi</th><th>Roli</th><th>Tuman</th><th>Bronlar</th><th>Kelmagan</th><th>Holat</th><th style={{ textAlign: 'right' }}>Amal</th></tr></thead>
              <tbody>
                {d.items.map((u) => {
                  const bl = u.status === 'blocked';
                  const j = isoDate(u.createdAt);
                  return (
                    <tr key={u.id} style={sel.has(u.id) ? { background: 'color-mix(in oklch, var(--error) 8%, transparent)' } : undefined}>
                      <td>{u.role !== 'admin' && <input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} aria-label={`${u.name} ni belgilash`} style={{ width: 18, height: 18, accentColor: 'var(--error)' }} />}</td>
                      <td><div className="row" style={{ gap: 12 }}><Avatar name={u.name} url={u.avatarUrl} size={40} /><div className="col"><b style={{ fontSize: 15 }}>{u.name}</b><span className="mono c3" style={{ fontSize: 11 }}>@{u.username} · {j.slice(0, 4)}-{MONTHS_SHORT[Number(j.slice(5, 7)) - 1]}</span><span className="mono c3" style={{ fontSize: 11 }}>{phone(u.phone)}</span></div></div></td>
                      <td style={{ fontSize: 14 }}>{ROLE[u.role]}{u.staff ? ' · xodim' : ''}</td>
                      <td style={{ fontSize: 14 }}>{u.district ?? '—'}</td>
                      <td className="mono" style={{ fontSize: 14 }}>{u.bookings}</td>
                      <td className="mono" style={{ fontSize: 14, color: u.noShows >= 3 ? 'var(--error)' : undefined }}>{u.noShows}</td>
                      <td><span className={`pill-tag ${bl ? 'error' : 'success'}`}>{bl ? 'Bloklangan' : 'Faol'}</span>{bl && <div className="c3" style={{ fontSize: 11, marginTop: 4 }}>{u.blockReason}{u.blockedUntil ? ` · ${dayMonthShort(isoDate(u.blockedUntil))} gacha` : ' · muddatsiz'}</div>}</td>
                      <td style={{ textAlign: 'right' }}><div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>{u.obyektivka && <Link href={`/admin/obyektivka/${u.id}`} className="icon-btn" title="Obyektivka ma’lumotlari" aria-label="Obyektivka ma’lumotlari"><Icon n="description" size={20} /></Link>}{u.role !== 'admin' && (bl ? <Btn className="btn btn-outline btn-sm" loading={busy === u.id} onClick={() => unblock(u)}>Blokdan chiqarish</Btn> : <button className="btn btn-danger-outline btn-sm" onClick={() => { setBlocking(u); setDays(7); setReason(u.noShows >= 3 ? 'Ko‘p marta kelmagan' : 'Qoidabuzarlik'); }}>Bloklash</button>)}{u.id !== me?.id && <button className="icon-btn" style={u.role === 'admin' ? { color: 'var(--brand-ink)' } : undefined} title={u.role === 'admin' ? 'Admin huquqini olish' : 'Admin huquqini berish'} aria-label={`${u.name}: ${u.role === 'admin' ? 'admin huquqini olish' : 'admin huquqini berish'}`} onClick={() => setRoleFor(u)}><Icon n="shield" size={20} fill={u.role === 'admin'} /></button>}{u.role !== 'admin' && <button className="icon-btn" style={{ color: 'var(--error)' }} title="Butunlay o‘chirish" aria-label={`${u.name} ni butunlay o‘chirish`} onClick={() => askDelete([u])}><Icon n="delete" size={20} /></button>}</div></td>
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
      <Modal open={!!roleFor} onClose={() => setRoleFor(null)} title={roleFor?.role === 'admin' ? `@${roleFor?.username} dan admin huquqini olish` : `@${roleFor?.username} ga admin huquqini berish`}>
        {roleFor?.role === 'admin'
          ? <p className="c2 t-small"><b>{roleFor.name}</b> admin panelga kira olmay qoladi va oddiy foydalanuvchi (futbolchi yoki stadion egasi) bo‘lib qoladi. Hisobi va ma’lumotlari saqlanadi.</p>
          : <p className="c2 t-small"><b>{roleFor?.name}</b> admin panelning hamma bo‘limiga kira oladi: foydalanuvchilarni bloklash va o‘chirish, obyektivka ma’lumotlarini ko‘rish, e’lon yuborish, boshqalarga admin huquqi berish. <b style={{ color: 'var(--warning)' }}>Faqat ishongan odamingizga bering.</b></p>}
        <Btn className={`btn btn-block ${roleFor?.role === 'admin' ? 'btn-danger' : 'btn-primary'}`} loading={busy === 'role'} onClick={setAdmin}>{roleFor?.role === 'admin' ? 'Admin huquqini olish' : 'Admin qilish'}</Btn>
      </Modal>
      {picked.length > 0 && (
        <div className="card row between wrap" style={{ position: 'sticky', bottom: 12, zIndex: 2, padding: 12, gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
          <span style={{ fontSize: 14 }}><b>{picked.length}</b> ta foydalanuvchi belgilandi</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setSel(new Set())}>Bekor qilish</button>
            <button className="btn btn-danger btn-sm" onClick={() => askDelete(picked)}><Icon n="delete" size={18} />Belgilanganlarni o‘chirish</button>
          </div>
        </div>
      )}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={deleting?.length === 1 ? `${deleting[0].name} ni butunlay o‘chirish` : `${deleting?.length} ta foydalanuvchini butunlay o‘chirish`}>
        <p className="c2 t-small">{deleting && deleting.length > 1 ? 'Belgilangan foydalanuvchilar' : 'Foydalanuvchi'} va {deleting && deleting.length > 1 ? 'ularga' : 'unga'} tegishli hamma narsa bazadan o‘chiriladi: profil, bronlar, postlar, xabarlar, obyektivka ma’lumotlari. <b style={{ color: 'var(--error)' }}>Buni qaytarib bo‘lmaydi.</b> Shu telefon raqami bilan qayta kirsa, yangi hisob ochiladi.</p>
        {deleting && deleting.length > 1 && (
          <div className="well" style={{ padding: 12, maxHeight: 132, overflowY: 'auto', fontSize: 13, lineHeight: 1.6 }}>
            {deleting.map((u) => <div key={u.id} className="row between" style={{ gap: 8 }}><span className="ellipsis">{u.name} <span className="mono c3">@{u.username}</span></span><span className="c3" style={{ flexShrink: 0 }}>{ROLE[u.role]}</span></div>)}
          </div>
        )}
        {impact && (
          <div className="well col" style={{ padding: 14, gap: 4, fontSize: 14 }}>
            <span>Bronlari: <b>{impact.bookings}</b> · Postlari: <b>{impact.posts}</b> · Reels: <b>{impact.reels}</b></span>
            {(impact.teams > 0 || impact.matches > 0) && <span style={{ color: 'var(--warning)' }}>Sardor bo‘lgan jamoalari: <b>{impact.teams}</b> · tashkil qilgan o‘yinlari: <b>{impact.matches}</b> – ular ham o‘chadi</span>}
            {impact.stadiums > 0 && <span style={{ color: 'var(--error)' }}>Stadionlari: <b>{impact.stadiums}</b> – ular va boshqa futbolchilarning shu stadionlardagi <b>{impact.stadiumBookings}</b> ta broni ham o‘chadi</span>}
          </div>
        )}
        <label className="field"><span>Tasdiqlash uchun <b className="mono">{confirmWord}</b> deb yozing</span><input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></label>
        <Btn className="btn btn-danger btn-block" loading={busy === 'delete'} disabled={confirmText.trim() !== confirmWord} onClick={remove}>{deleting && deleting.length > 1 ? `${deleting.length} ta foydalanuvchini o‘chirish` : 'Butunlay o‘chirish'}</Btn>
      </Modal>
    </>
  );
}

export default function AdminUsers() {
  return <Suspense><Inner /></Suspense>;
}
