'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Btn, Empty, Icon, Loading, Modal, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { patch } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { dayMonthShort, isoDate } from '@/lib/format';

type S = 'pending' | 'approved' | 'rejected' | 'failed';
type A = { id: string; user: { id: string; name: string; username: string | null; avatarUrl: string | null; district: string | null }; claimed: number; count: number | null; status: S | 'processing'; code: string; videoUrl: string | null; posterUrl: string | null; durationSec: number | null; elapsedSec: number; rejectReason: string | null; reviewedBy: string | null; createdAt: string; userBest: number };
const REASONS = ['Kod videoda ko‘rinmaydi', 'Video uzluksiz emas', 'Tana to‘liq ko‘rinmaydi', 'Son noto‘g‘ri – to‘p yerga tushgan', 'Boshqa odam'];

/** Jonglyor videolarini moderatsiya qilish */
export default function AdminJuggle() {
  const toast = useToast();
  const [status, setStatus] = useState<S>('pending');
  const r = useApi<{ counts: Partial<Record<S, number>>; items: A[] }>(`/admin/juggle?status=${status}`);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<A | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const act = async (a: A, body: object, msg: string) => {
    setBusy(a.id);
    try { await patch(`/admin/juggle/${a.id}`, body); toast(msg); setRejecting(null); r.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  const c = r.data?.counts ?? {};
  return (
    <>
      <AdminHeader title="Jonglyor moderatsiyasi"><Link href="/battle" className="btn btn-outline btn-sm"><Icon n="leaderboard" size={18} />Reyting</Link></AdminHeader>
      <p className="c2 t-small" style={{ maxWidth: 720 }}>Tekshiring: videoning burchagida <b>kod</b> ko‘rinib tursin va pastdagi kod bilan bir xil bo‘lsin, video uzluksiz bo‘lsin, butun tana ko‘rinsin. Sonni o‘zingiz sanang – farq qilsa, to‘g‘ri sonni yozib tasdiqlang.</p>
      <Seg value={status} onChange={setStatus} items={[['pending', 'Kutilmoqda', c.pending], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['failed', 'Qabul qilinmagan']]} />
      {!r.data ? <Loading rows={3} /> : !r.data.items.length ? <div className="card"><Empty icon="sports_soccer" title={status === 'pending' ? 'Tekshiriladigan video yo‘q' : 'Bo‘sh'} /></div> : (
        <div className="jg-mod">
          {r.data.items.map((a) => (
            <div key={a.id} className="card col" style={{ padding: 14, gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={a.user.name} url={a.user.avatarUrl} size={36} />
                <div className="col grow" style={{ minWidth: 0 }}><Link href={`/u/${a.user.username}`} className="ellipsis" style={{ fontWeight: 700, color: 'var(--text-1)' }}>{a.user.name}</Link><span className="mono c3" style={{ fontSize: 11 }}>@{a.user.username}{a.user.district ? ` · ${a.user.district}` : ''} · rekordi {a.userBest}</span></div>
                <span className="mono c3" style={{ fontSize: 11 }}>{dayMonthShort(isoDate(a.createdAt))}</span>
              </div>
              {a.videoUrl ? <video src={a.videoUrl} poster={a.posterUrl ?? undefined} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }} /> : <div className="well" style={{ padding: 20, textAlign: 'center' }}>Video yo‘q</div>}
              <div className="row wrap" style={{ gap: 12, fontSize: 13 }}>
                <span>Kod: <b className="mono" style={{ fontSize: 15 }}>{a.code}</b></span>
                <span className="c2">Uzunligi: <b className="mono">{a.durationSec ? Math.round(a.durationSec) : '—'}s</b> (yozish {Math.round(a.elapsedSec)}s)</span>
              </div>
              <div className="row between" style={{ gap: 8 }}>
                <span style={{ fontSize: 14 }}>Kiritgani: <b className="mono" style={{ fontSize: 20 }}>{a.claimed}</b>{a.count != null && a.count !== a.claimed && <> → <b className="mono ink" style={{ fontSize: 20 }}>{a.count}</b></>}</span>
                {a.status !== 'pending' && <span className={`pill-tag ${a.status === 'approved' ? 'success' : 'error'}`}>{a.status === 'approved' ? 'Tasdiqlangan' : a.status === 'rejected' ? 'Rad etilgan' : 'Qabul qilinmagan'}</span>}
              </div>
              {a.rejectReason && <span style={{ fontSize: 12, color: 'var(--error)' }}>{a.rejectReason}</span>}
              {a.reviewedBy && <span className="c3" style={{ fontSize: 11 }}>Tekshirdi: {a.reviewedBy}</span>}
              {(a.status === 'pending' || a.status === 'approved' || a.status === 'rejected') && (
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" type="number" inputMode="numeric" min={1} max={9999} aria-label="Tasdiqlanadigan son" placeholder={String(a.count ?? a.claimed)} value={counts[a.id] ?? ''} onChange={(e) => setCounts({ ...counts, [a.id]: e.target.value })} style={{ width: 90, height: 40 }} />
                  <Btn className="btn btn-primary btn-sm grow" loading={busy === a.id} onClick={() => { const n = Number(counts[a.id] || a.count || a.claimed); act(a, { action: 'approve', count: n }, `Tasdiqlandi: ${n} ta`); }}><Icon n="check" size={18} />{a.status === 'approved' ? 'Sonni yangilash' : 'Tasdiqlash'}</Btn>
                  {a.status !== 'rejected' && <button className="btn btn-danger-outline btn-sm" onClick={() => { setRejecting(a); setReason(REASONS[0]); }}>Rad etish</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Urinishni rad etish">
        <div className="row wrap" style={{ gap: 8 }}>{REASONS.map((x) => <button key={x} className={`chip ${reason === x ? 'on' : ''}`} onClick={() => setReason(x)}>{x}</button>)}</div>
        <label className="field"><span>Sabab (foydalanuvchiga ko‘rinadi)</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
        <Btn className="btn btn-danger btn-block" loading={busy === rejecting?.id} disabled={reason.trim().length < 3} onClick={() => rejecting && act(rejecting, { action: 'reject', reason }, 'Rad etildi')}>Rad etish</Btn>
      </Modal>
    </>
  );
}
