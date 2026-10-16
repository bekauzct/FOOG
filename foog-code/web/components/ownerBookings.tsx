'use client';
import { useState } from 'react';
import { Btn, Icon, Modal } from './ui';
import { patch } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { sum } from '@/lib/format';

export type OB = {
  id: string; code: string; date: string; start: string; end: string; price: number; status: string; rejectReason: string | null; createdAt: string;
  pitch: { id: string; name: string; size: string }; user: { id: string; name: string; username: string | null; avatarUrl: string | null; phone: string | null; noShows: number };
};

export const REJECT_REASONS = ['Bu vaqtda maydon band', 'Ta’mirlash ishlari', 'Ob-havo sababli', 'Mijoz bilan bog‘lanib bo‘lmadi', 'Boshqa sabab'];

/** Bron harakatlari: tasdiqlash, sabab bilan rad etish, keldi / kelmadi – «Bekor qilish» imkoniyati bilan */
export function useBookingActions(onChange: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<OB | null>(null);
  const run = async (b: OB, action: 'confirm' | 'reject' | 'arrived' | 'no_show', reason?: string) => {
    setBusy(b.id + action);
    try {
      await patch(`/bookings/${b.id}`, { action, reason });
      const msg = action === 'confirm' ? `${b.user.name} · ${b.start} tasdiqlandi. Mijozga Telegram orqali xabar ketdi.` : action === 'reject' ? `${b.code} rad etildi` : action === 'arrived' ? `${sum(b.price)} hisobotga qo‘shildi` : `${b.user.name} – kelmadi deb belgilandi`;
      toast(msg, { kind: action === 'reject' || action === 'no_show' ? 'warn' : 'ok', undo: async () => { try { await patch(`/bookings/${b.id}`, { action: 'undo' }); onChange(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } } });
      onChange();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); onChange(); } finally { setBusy(null); }
  };
  const modal = <RejectModal b={rejecting} onClose={() => setRejecting(null)} onReject={(r) => { const b = rejecting!; setRejecting(null); run(b, 'reject', r); }} />;
  return { busy, run, reject: (b: OB) => setRejecting(b), modal };
}

function RejectModal({ b, onClose, onReject }: { b: OB | null; onClose: () => void; onReject: (reason: string) => void }) {
  const [r, setR] = useState<string | null>(null);
  const [other, setOther] = useState('');
  if (!b) return null;
  const reason = r === 'Boshqa sabab' ? other.trim() : r;
  return (
    <Modal open onClose={onClose} title="Bronni rad etish">
      <p className="c2 t-small">{b.user.name} · {b.code} · {b.start}. Sabab futbolchiga Telegram va bildirishnoma orqali yuboriladi.</p>
      <div className="row wrap" style={{ gap: 8 }}>{REJECT_REASONS.map((x) => <button key={x} className={`chip ${r === x ? 'on' : ''}`} onClick={() => setR(x)}>{x}</button>)}</div>
      {r === 'Boshqa sabab' && <input className="input" autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder="Sababni yozing" maxLength={200} />}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={onClose}>Bekor qilish</button>
        <Btn className="btn btn-danger" disabled={!reason} onClick={() => reason && onReject(reason)}><Icon n="block" size={18} />Rad etish</Btn>
      </div>
    </Modal>
  );
}
