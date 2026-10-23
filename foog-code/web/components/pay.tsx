'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Art, Btn, Icon, Modal } from '@/components/ui';
import { ApiError, post, upload } from '@/lib/api';
import { sum } from '@/lib/format';

export type PayMethod = { code: string; name: string; description: string | null; badge: string | null; color: string | null; status: 'on' | 'msg' | 'off'; kind: 'manual' | 'gateway' };
type Checkout = { kind: 'manual'; card: { bank: string; holder: string; number: string; masked: string }; instruction: string };
type Started = { payment: { id: string; code: string; amount: number }; checkout: Checkout };

/**
 * To‘lov oynasi – 3 bosqich: usul → karta va chek → yuborildi.
 * Click/Payme kabi usullar «xizmat xabari» rejimida: bosilganda xabar chiqadi.
 */
export function PayModal({ purpose, title, amount, methods, serviceDown, team, teamId, onClose, onSent }: {
  purpose: 'team_create' | 'team_monthly'; title: string; amount: number; methods: PayMethod[]; serviceDown: string;
  team?: { name: string }; teamId?: string; onClose: () => void; onSent: (code: string) => void;
}) {
  const [step, setStep] = useState<'method' | 'card' | 'sent'>('method');
  const [err, setErr] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (m: PayMethod) => {
    setErr(null); setDown(false);
    if (m.status === 'msg') return setDown(true);
    setBusy(m.code);
    try {
      const r = await post<Started>('/payments', { purpose, method: m.code, ...(team ? { team } : {}), ...(teamId ? { teamId } : {}) });
      setStarted(r); setStep('card');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'payment_unavailable') setDown(true);
      else setErr((e as Error).message);
    } finally { setBusy(null); }
  };
  const choose = (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErr('Chek rasm bo‘lishi kerak: JPG yoki PNG');
    if (f.size > 5 * 1024 * 1024) return setErr('Rasm 5 MB dan katta');
    setFile(f);
  };
  const send = async () => {
    if (!file || !started) return;
    setBusy('send'); setErr(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      await upload(`/payments/${started.payment.id}/receipt`, fd);
      setStep('sent'); onSent(started.payment.code);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const copy = () => { try { void navigator.clipboard?.writeText(started!.checkout.card.number.replace(/\s/g, '')); } catch { /* clipboard yopiq */ } setCopied(true); };

  const label = { method: '1 / 3 · USUL', card: '2 / 3 · KARTA ORQALI', sent: '3 / 3 · YUBORILDI' }[step];
  return (
    <Modal open onClose={() => busy !== 'send' && onClose()} title={<span className="col" style={{ gap: 4 }}><span className="label-sm c3">{label}</span><span>{step === 'sent' ? 'Tayyor' : 'To‘lov qilish'}</span></span>}>
      {step === 'method' && (
        <>
          <div className="well row between" style={{ padding: 16, gap: 12 }}>
            <span className="col" style={{ gap: 2, minWidth: 0 }}><span className="c2 t-small">To‘lov maqsadi</span><b className="ellipsis" style={{ fontSize: 15 }}>{title}</b></span>
            <span className="mono" style={{ fontSize: 22, whiteSpace: 'nowrap' }}>{sum(amount)}</span>
          </div>
          <b style={{ fontSize: 15 }}>To‘lov usuli</b>
          <div className="col" style={{ gap: 10 }}>
            {methods.map((m) => (
              <button key={m.code} className="pay-method" onClick={() => pick(m)} disabled={!!busy}>
                <span className="pay-tile" style={{ background: m.color ?? 'var(--surface-2)' }}>{m.kind === 'manual' ? <Icon n="credit_card" size={20} /> : m.badge ?? m.name[0]}</span>
                <span className="col grow" style={{ minWidth: 0, textAlign: 'left' }}><b style={{ fontSize: 15 }}>{m.name}</b>{m.description && <span className="c2 t-small">{m.description}</span>}</span>
                {busy === m.code ? <span className="spin" /> : <Icon n="chevron_right" style={{ color: 'var(--text-3)' }} />}
              </button>
            ))}
          </div>
          {down && <div role="alert" className="row pay-alert"><Icon n="cloud_off" size={20} /><span>{serviceDown}</span></div>}
          {err && <div role="alert" className="row pay-alert"><Icon n="error" size={20} /><span>{err}</span></div>}
        </>
      )}
      {step === 'card' && started && (
        <>
          <div className="pay-card">
            <div className="row between" style={{ gap: 8 }}><span style={{ fontSize: 13, opacity: 0.75 }}>{started.checkout.card.bank}</span><span style={{ fontSize: 13, opacity: 0.75 }}>O‘tkazish summasi</span></div>
            <div className="row between wrap" style={{ gap: 8 }}><span className="mono" style={{ fontSize: 'clamp(17px, 5vw, 22px)', letterSpacing: '.04em' }}>{started.checkout.card.number}</span><span className="mono" style={{ fontSize: 18 }}>{sum(started.payment.amount)}</span></div>
            <div className="row between" style={{ gap: 8 }}><span style={{ fontSize: 14 }}>{started.checkout.card.holder}</span>
              <button className="btn btn-sm" style={{ background: copied ? 'var(--volt)' : 'transparent', color: '#091025', boxShadow: copied ? 'none' : 'inset 0 0 0 1.5px rgba(9,16,37,.25)' }} onClick={copy}><Icon n={copied ? 'check' : 'content_copy'} size={18} />{copied ? 'Nusxa olindi' : 'Nusxa olish'}</button>
            </div>
          </div>
          {started.checkout.instruction && <p className="c2" style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{started.checkout.instruction}</p>}
          <b style={{ fontSize: 15 }}>To‘lov cheki (skrinshot)</b>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => choose(e.target.files?.[0])} />
          {!file ? (
            <button className="pay-drop" onClick={() => input.current?.click()}><Icon n="add_photo_alternate" size={32} /><b style={{ fontSize: 14 }}>Skrinshotni tanlang</b><span className="c2 t-cap">JPG yoki PNG · 5 MB gacha</span></button>
          ) : (
            <div className="well row" style={{ padding: 12, gap: 12 }}>
              <span className="ph" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: `center/cover url("${preview}")` }} />
              <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 14 }}>{file.name}</b><span className="mono c3" style={{ fontSize: 12 }}>{Math.max(1, Math.round(file.size / 1024))} KB</span></span>
              <button className="icon-btn ghost" aria-label="Chekni olib tashlash" onClick={() => setFile(null)}><Icon n="close" /></button>
            </div>
          )}
          {err && <div role="alert" className="row pay-alert"><Icon n="error" size={20} /><span>{err}</span></div>}
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-outline btn-lg" style={{ flex: 1 }} onClick={() => setStep('method')} disabled={busy === 'send'}>Ortga</button>
            <Btn className="btn btn-primary btn-lg" style={{ flex: 2 }} disabled={!file} loading={busy === 'send'} onClick={send}>{busy === 'send' ? 'Yuborilmoqda…' : 'Chekni yuborish'}</Btn>
          </div>
        </>
      )}
      {step === 'sent' && started && (
        <div className="col" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Art pose="receipt_check" size={120} />
          <h3 style={{ fontSize: 22, fontWeight: 800 }}>Chek adminga yuborildi</h3>
          <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>Admin tekshirgach, {purpose === 'team_create' ? 'jamoangiz faollashadi.' : 'obuna 30 kunga uzayadi.'} Natija Telegram’ga keladi.</p>
          <span className="mono pill-tag accent">{started.payment.code}</span>
          <button className="btn btn-primary btn-lg btn-block" onClick={onClose}>Tayyor</button>
        </div>
      )}
    </Modal>
  );
}
