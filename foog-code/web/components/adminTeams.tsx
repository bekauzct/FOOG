'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Btn, Empty, Icon, Loading, Modal } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { del, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { SKILL_LABEL, ago, dayMonth } from '@/lib/format';

type TeamRow = { id: string; name: string; short: string; district: string | null; level: string; members: number; captain: { id: string; name: string; username: string | null }; createdAt: string; status: 'active' | 'frozen' | 'pending'; paidUntil: string | null };
const TST: Record<TeamRow['status'], [string, string]> = { active: ['FAOL', 'success'], frozen: ['MUZLATILGAN', 'error'], pending: ['TEKSHIRILMOQDA', 'warning'] };

/** Admin: barcha jamoalar – holat, obuna muddati, o‘chirish */
export function AdminTeamsList() {
  const [q, setQ] = useState('');
  const r = useApi<{ items: TeamRow[] }>(`/admin/teams${qs({ q: q.trim() || undefined })}`);
  const [sel, setSel] = useState<TeamRow | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const remove = async () => {
    if (!sel) return;
    setBusy(true);
    try { await del(`/admin/teams/${sel.id}`); toast(`«${sel.name}» o‘chirildi · kapitan va a’zolarga xabar ketdi`, { kind: 'warn' }); setSel(null); r.reload(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="row between wrap" style={{ gap: 8 }}>
        <div className="search" style={{ width: 'min(360px,100%)' }}><Icon n="search" size={22} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jamoa yoki kapitan nomi" aria-label="Qidirish" /></div>
        {r.data && <span className="mono c2" style={{ fontSize: 13 }}>{r.data.items.length} ta jamoa</span>}
      </div>
      <Async q={r} loading={<Loading rows={3} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="groups" title="Jamoa topilmadi" /></div>}>
        {(d) => (
          <div className="card col" style={{ padding: 0 }}>
            {d.items.map((t) => (
              <div key={t.id} className="row" style={{ gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', minHeight: 64 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px var(--font-ui)', flexShrink: 0 }}>{t.short}</span>
                <span className="col grow" style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 8, minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 15 }}>{t.name}</b><span className={`pill-tag ${TST[t.status]?.[1] ?? 'muted'}`}>{TST[t.status]?.[0] ?? t.status}</span></span>
                  <span className="c2 ellipsis" style={{ fontSize: 13 }}>Kapitan: {t.captain.username ? <Link href={`/u/${t.captain.username}`}>{t.captain.name}</Link> : t.captain.name} · {t.members} a’zo · {SKILL_LABEL[t.level]}{t.district ? ` · ${t.district}` : ''}</span>
                  <span className="mono c3" style={{ fontSize: 11 }}>Tuzilgan: {ago(t.createdAt)}{t.paidUntil ? ` · obuna ${dayMonth(t.paidUntil)} gacha` : ' · muddatsiz'}</span>
                </span>
                <button className="btn btn-danger-outline btn-sm" onClick={() => setSel(t)}>O‘chirish</button>
              </div>
            ))}
          </div>
        )}
      </Async>
      {sel && (
        <Modal open onClose={() => setSel(null)} title="Tasdiqlang">
          <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>«{sel.name}» jamoasini o‘chirasizmi? Jamoa chati ham o‘chadi, kapitan va {sel.members - 1} a’zoga xabar boradi. Amal audit jurnaliga yoziladi.</p>
          <div className="row" style={{ gap: 8 }}><button className="btn btn-outline grow" onClick={() => setSel(null)}>Bekor qilish</button><Btn className="btn btn-danger grow" loading={busy} onClick={remove}>O‘chirish</Btn></div>
        </Modal>
      )}
    </>
  );
}
