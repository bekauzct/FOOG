'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Async, Avatar, Empty, Icon, Loading } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { qs } from '@/lib/api';
import { dayMonthShort, isoDate, phone } from '@/lib/format';

type Row = { userId: string; user: { name: string; username: string | null; phone: string | null; avatarUrl: string | null }; fish: string; lavozim: string; tugSana: string; updatedAt: string };

/** Foydalanuvchilar online.obyektivka’da to‘ldirgan ma’lumotlar */
export default function AdminObyektivka() {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const r = useApi<{ total: number; items: Row[] }>(`/admin/obyektivka${qs({ q: dq })}`);
  return (
    <>
      <AdminHeader title="Obyektivka ma’lumotlari"><Link href="/admin/users" className="btn btn-outline btn-sm"><Icon n="group" size={18} />Foydalanuvchilar</Link></AdminHeader>
      <div className="row between wrap" style={{ gap: 12 }}>
        <p className="c2 t-small" style={{ maxWidth: 560 }}>Foydalanuvchi obyektivka to‘ldirganda ma’lumotlari shu yerga yozilib boradi. Jami: <b>{r.data?.total ?? '…'}</b></p>
        <div className="search" style={{ height: 44, width: 'min(320px,100%)' }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="F.I.Sh., @username yoki telefon" aria-label="Qidirish" /></div>
      </div>
      <Async q={r} loading={<Loading rows={5} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="description" title={dq ? 'Topilmadi' : 'Hali hech kim obyektivka to‘ldirmagan'} /></div>}>
        {(d) => (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="ow-table">
              <thead><tr><th>Foydalanuvchi</th><th>F.I.Sh.</th><th>Lavozimi</th><th>Tug‘ilgan</th><th>Yangilangan</th><th style={{ textAlign: 'right' }}>Amal</th></tr></thead>
              <tbody>
                {d.items.map((p) => (
                  <tr key={p.userId}>
                    <td><div className="row" style={{ gap: 12 }}><Avatar name={p.user.name} url={p.user.avatarUrl} size={40} /><div className="col"><b style={{ fontSize: 15 }}>{p.user.name}</b><span className="mono c3" style={{ fontSize: 11 }}>@{p.user.username} · {phone(p.user.phone)}</span></div></div></td>
                    <td style={{ fontSize: 14, fontWeight: 600 }}>{p.fish || '—'}</td>
                    <td style={{ fontSize: 14, maxWidth: 280 }}><span className="ellipsis" style={{ display: 'block' }}>{p.lavozim || '—'}</span></td>
                    <td className="mono" style={{ fontSize: 13 }}>{p.tugSana || '—'}</td>
                    <td className="mono c3" style={{ fontSize: 12 }}>{dayMonthShort(isoDate(p.updatedAt))}</td>
                    <td style={{ textAlign: 'right' }}><Link href={`/admin/obyektivka/${p.userId}`} className="btn btn-outline btn-sm">Ko‘rish va tahrirlash</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </>
  );
}
