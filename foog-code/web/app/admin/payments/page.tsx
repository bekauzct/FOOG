'use client';
import { useEffect, useState } from 'react';
import { Async, Avatar, Btn, Empty, Icon, Loading, Modal } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { del, patch, post, put, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { MONTHS, num, phone, sum, tashkent } from '@/lib/format';

type Req = {
  id: string; code: string; purpose: string; purposeT: string; amount: number; status: 'review' | 'approved' | 'fraud'; team: string | null;
  createdAt: string; submittedAt: string | null; decidedAt: string | null; hasReceipt: boolean; decidedBy: string | null; decidedVia: string | null;
  user: { id: string; name: string; username: string | null; phone: string | null; telegramId: string | null; fraudStreak: number };
};
type Method = { id: string; code: string; name: string; description: string | null; badge: string | null; color: string | null; status: 'on' | 'msg' | 'off'; kind: string; provider: string; sort: number };
type Card = { id: string; number: string; masked: string; holder: string; bank: string; active: boolean; primary: boolean };

const dt = (iso: string) => { const t = tashkent(new Date(iso)); return `${Number(t.date.slice(8))}-${MONTHS[Number(t.date.slice(5, 7)) - 1].slice(0, 3)}, ${t.time}`; };
const STATUS: Record<string, [string, string]> = { review: ['TEKSHIRUVDA', 'warning'], approved: ['TASDIQLANDI', 'success'], fraud: ['ALDOV', 'error'] };
const SERVICE_DOWN = 'Server vaqtincha ishlamayapti. Iltimos, birozdan keyin qayta urinib ko‘ring yoki admin orqali karta yordamida to‘lov qiling.';

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>{children}</button>;
}

// ---------------- To‘lov so‘rovlari ----------------
function Requests({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<'review' | 'approved' | 'fraud' | 'all'>('review');
  const q = useApi<{ items: Req[]; counts: Record<string, number>; fraudLimit: number }>(`/admin/payments/requests${qs({ status })}`);
  const [selId, setSelId] = useState<string | null>(null);
  const [call, setCall] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const items = q.data?.items ?? [];
  const sel = items.find((r) => r.id === selId) ?? items[0];
  useEffect(() => setCall(false), [sel?.id]);
  const decide = async (r: Req, decision: 'approve' | 'fraud') => {
    setBusy(decision);
    try {
      const res = await post<{ status: string; blocked: boolean }>(`/admin/payments/requests/${r.id}/decide`, { decision });
      toast(decision === 'approve' ? `${r.code} tasdiqlandi · foydalanuvchiga xabar ketdi` : res.blocked ? `${r.user.name} 24 soatga bloklandi` : `${r.code} aldov deb belgilandi`, { kind: decision === 'approve' ? 'ok' : 'warn' });
      q.reload(); onChange();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); q.reload(); } finally { setBusy(null); }
  };
  const limit = q.data?.fraudLimit ?? 5;
  return (
    <div className="ap-grid">
      <div className="col" style={{ gap: 10 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {([['review', `Tekshiruvda · ${q.data?.counts.review ?? 0}`], ['approved', 'Tasdiqlangan'], ['fraud', 'Aldov'], ['all', 'Hammasi']] as const).map(([k, t]) => <Chip key={k} on={status === k} onClick={() => { setStatus(k); setSelId(null); }}>{t}</Chip>)}
        </div>
        {q.loading && !q.data ? <Loading rows={3} /> : !items.length ? <div className="card"><Empty icon="receipt_long" title="Bu bo‘limda so‘rov yo‘q." /></div> : items.map((r) => (
          <button key={r.id} className="ap-req" onClick={() => setSelId(r.id)} style={{ boxShadow: r.id === sel?.id ? 'inset 0 0 0 2px var(--brand-ink)' : 'inset 0 0 0 1px var(--border)' }}>
            <span className="row between" style={{ gap: 8 }}><b className="ellipsis" style={{ fontSize: 15 }}>{r.user.name}</b><span className="mono" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{sum(r.amount)}</span></span>
            <span className="row between" style={{ gap: 8 }}><span className="c2 t-small ellipsis">{r.team ?? '—'} · {r.purposeT}</span><span className={`pill-tag ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></span>
            {r.status === 'review' && r.user.fraudStreak >= 3 && <span style={{ color: 'var(--error)', fontSize: 13 }}>Ketma-ket {r.user.fraudStreak} ta aldov · keyingisi – 24 soat blok</span>}
          </button>
        ))}
      </div>

      {sel ? (
        <div className="card col" style={{ padding: 20, gap: 16, minWidth: 0 }}>
          <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span className="col" style={{ gap: 4 }}><span className="mono c3" style={{ fontSize: 12 }}>{sel.code} · {dt(sel.submittedAt ?? sel.createdAt)}</span><b style={{ fontSize: 26 }}>{sum(sel.amount)}</b><span className="c2">{sel.purposeT} · {sel.team ?? '—'}</span></span>
            <span className={`pill-tag ${STATUS[sel.status][1]}`}>{STATUS[sel.status][0]}</span>
          </div>
          <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
            <div className="col" style={{ gap: 6, width: 'min(180px, 100%)' }}>
              {sel.hasReceipt ? <a href={`/api/v1/payments/${sel.id}/receipt`} target="_blank" rel="noreferrer" className="ph" style={{ display: 'block', aspectRatio: '9/16', borderRadius: 14, background: `center/cover no-repeat url("/api/v1/payments/${sel.id}/receipt")` }} aria-label="Chek skrinshotini ochish" /> : <div className="ph" style={{ aspectRatio: '9/16', borderRadius: 14 }} />}
              <span className="c3 t-cap">Chek skrinshoti · faqat adminlarga ko‘rinadi</span>
            </div>
            <div className="col grow" style={{ minWidth: 220 }}>
              {([['Foydalanuvchi', sel.user.name], ['Telegram ID', sel.user.telegramId ?? '—'], ['Telefon', sel.user.phone ? phone(sel.user.phone) : 'yo‘q'], ['Jamoa', sel.team ?? '—'], ['To‘lov turi', sel.purposeT], ['Yuborilgan', sel.submittedAt ? dt(sel.submittedAt) : '—'], ['Ketma-ket aldov', `${sel.user.fraudStreak} / ${limit}`]] as const).map(([k, v], i) => (
                <div key={k} className="ap-row"><span className="c2">{k}</span><span className="mono" style={{ textAlign: 'right', color: i === 6 && sel.user.fraudStreak >= 3 ? 'var(--error)' : undefined }}>{v}</span></div>
              ))}
            </div>
          </div>
          {call && (
            <div className="tm-banner" style={{ background: 'var(--surface-2)' }}>
              <Icon n="call" />
              <span className="grow">{sel.user.phone ? `${sel.user.name}: ${phone(sel.user.phone)}` : 'Foydalanuvchi telefon raqamini ulashmagan. Telegram orqali yozing.'}</span>
              {sel.user.phone ? <a className="btn btn-primary btn-sm" href={`tel:${sel.user.phone}`}>Qo‘ng‘iroq</a> : sel.user.username && <a className="btn btn-outline btn-sm" href={`https://t.me/${sel.user.username}`} target="_blank" rel="noreferrer">Telegram</a>}
            </div>
          )}
          {sel.status === 'review' ? (
            <div className="row wrap" style={{ gap: 10 }}>
              <Btn className="btn btn-danger-outline btn-lg" loading={busy === 'fraud'} disabled={!!busy} onClick={() => decide(sel, 'fraud')}><Icon n="gpp_bad" />Aldov</Btn>
              <button className="btn btn-outline btn-lg" onClick={() => setCall(true)}><Icon n="call" />Telefon qilish</button>
              <Btn className="btn btn-primary btn-lg grow" loading={busy === 'approve'} disabled={!!busy} onClick={() => decide(sel, 'approve')}><Icon n="verified" />To‘g‘ri</Btn>
            </div>
          ) : (
            <div className="tm-banner" style={{ background: 'var(--surface-2)', color: sel.status === 'approved' ? 'var(--success)' : 'var(--error)' }}>
              <Icon n="lock" /><span>{sel.status === 'approved' ? 'Tasdiqlangan' : 'Aldov deb belgilangan'} · {sel.decidedBy ?? '—'}{sel.decidedVia === 'bot' ? ' (bot)' : ''} · {sel.decidedAt ? dt(sel.decidedAt) : ''}. Qaror o‘zgartirilmaydi.</span>
            </div>
          )}
        </div>
      ) : <div className="card"><Empty icon="receipt_long" title="So‘rov tanlanmagan" /></div>}

      {sel && (
        <div className="col" style={{ gap: 10 }}>
          <b className="row" style={{ gap: 8, fontSize: 15 }}><Icon n="send" size={20} style={{ color: 'var(--accent)' }} />Botga shunday keladi</b>
          <div className="ap-tg">
            <div className="ph" style={{ height: 120, borderRadius: 10, background: sel.hasReceipt ? `center/cover no-repeat url("/api/v1/payments/${sel.id}/receipt")` : undefined }} />
            <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-line' }}>
              <b>💳 Yangi to‘lov · {sel.code}</b>{'\n'}👤 {sel.user.name} · ID {sel.user.telegramId ?? '—'}{'\n'}📞 {sel.user.phone ? phone(sel.user.phone) : 'raqam yo‘q'}{'\n'}⚽ {sel.team ?? '—'}{'\n'}🧾 {sel.purposeT} · {sum(sel.amount)}{sel.user.fraudStreak ? `\n⚠️ Ketma-ket aldov: ${sel.user.fraudStreak} / ${limit}` : ''}
              {sel.status !== 'review' && <><br /><br />{sel.status === 'approved' ? '✅ To‘g‘ri' : '⛔ Aldov'} · {sel.decidedBy ?? 'admin'}</>}
            </div>
            {sel.status === 'review' && <div className="ap-tg-btns"><span>⛔ Aldov</span><span>✅ To‘g‘ri</span><span>📞 Telefon</span></div>}
          </div>
          <span className="c3 t-cap" style={{ lineHeight: 1.5 }}>Qaror saytda yoki botda qabul qilinadi – ikkinchi joyda tugmalar avtomatik yopiladi. Bitta so‘rovni qayta tasdiqlab yoki rad etib bo‘lmaydi.</span>
        </div>
      )}
    </div>
  );
}

// ---------------- Tarif va limit ----------------
function Tariff() {
  const q = useApi<{ createPrice: number; monthlyPrice: number; memberLimit: number; periodDays: number; fraudLimit: number; blockHours: number }>('/admin/payments/tariff');
  const [draft, setDraft] = useState<{ createPrice: number; monthlyPrice: number; memberLimit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (q.data) setDraft({ createPrice: q.data.createPrice, monthlyPrice: q.data.monthlyPrice, memberLimit: q.data.memberLimit }); }, [q.data]);
  const save = async () => { if (!draft) return; setBusy(true); try { await put('/admin/payments/tariff', draft); toast('Tarif saqlandi'); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); } };
  return (
    <Async q={q}>
      {(t) => draft && (
        <div className="ap-two" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
          <div className="card col" style={{ padding: 20, gap: 16 }}>
            <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>Jamoa tarifi</b><span className="c2 t-small">O‘zgarish yangi to‘lovlarga darhol, mavjud obunalarga keyingi oydan qo‘llanadi.</span></span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {([['createPrice', 'Jamoa yaratish narxi', 'so‘m', 'Bir martalik, birinchi oy kiradi'], ['monthlyPrice', 'Oylik obuna', 'so‘m', `Har ${t.periodDays} kunda`], ['memberLimit', 'A’zolar limiti', 'kishi', 'Kapitan bilan birga']] as const).map(([k, l, u, h]) => (
                <label key={k} className="field"><span>{l}</span>
                  <span className="row input" style={{ gap: 8 }}><input inputMode="numeric" style={{ border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', width: '100%', outline: 'none' }} value={num(draft[k])} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })} /><span className="c3 t-cap">{u}</span></span>
                  <span className="c3 t-cap">{h}</span>
                </label>
              ))}
            </div>
            <div className="col" style={{ gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <b style={{ fontSize: 15 }}>Firibgarlikdan himoya</b>
              {([['Ketma-ket aldov limiti', `${t.fraudLimit} ta`], ['Blok muddati', `${t.blockHours} soat`], ['Blokda yopiladi', 'jamoa yaratish, to‘lov yuborish']] as const).map(([k, v]) => <div key={k} className="row between" style={{ fontSize: 14 }}><span className="c2">{k}</span><span className="mono">{v}</span></div>)}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setDraft({ createPrice: t.createPrice, monthlyPrice: t.monthlyPrice, memberLimit: t.memberLimit })}>Bekor qilish</button>
              <Btn className="btn btn-primary" loading={busy} disabled={draft.memberLimit < 2} onClick={save}>Saqlash</Btn>
            </div>
          </div>
          <div className="card col" style={{ padding: 20, gap: 4 }}>
            <b style={{ fontSize: 16, marginBottom: 6 }}>Foydalanuvchi shunday ko‘radi</b>
            {([['Jamoa yaratish', sum(draft.createPrice)], ['Oylik obuna', sum(draft.monthlyPrice)], ['A’zolar limiti', `${draft.memberLimit} kishi`]] as const).map(([k, v]) => <div key={k} className="ap-row"><span className="c2">{k}</span><span className="mono">{v}</span></div>)}
          </div>
        </div>
      )}
    </Async>
  );
}

// ---------------- To‘lov usullari va kartalar ----------------
function MethodForm({ m, providers, onClose, onDone }: { m?: Method; providers: { key: string; label: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: m?.code ?? '', name: m?.name ?? '', provider: m?.provider ?? 'gateway', description: m?.description ?? '', badge: m?.badge ?? '', color: m?.color ?? '#3B4253', status: m?.status ?? 'off' as Method['status'] });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, description: f.description || null, badge: f.badge || null };
      if (m) await patch(`/admin/payments/methods/${m.id}`, body); else await post('/admin/payments/methods', body);
      toast(m ? 'Usul saqlandi' : 'Usul qo‘shildi'); onDone(); onClose();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={m ? 'Usulni tahrirlash' : 'To‘lov usuli qo‘shish'}>
      <div className="row" style={{ gap: 8 }}>
        <label className="field grow"><span>Nomi</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Uzum" /></label>
        <label className="field" style={{ width: 130 }}><span>Kod</span><input className="input" value={f.code} disabled={!!m} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} placeholder="uzum" /></label>
      </div>
      <label className="field"><span>Modul</span><select className="select" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>{providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
      <label className="field"><span>Tavsif</span><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Avtomatik to‘lov" /></label>
      <div className="row" style={{ gap: 8 }}>
        <label className="field" style={{ width: 100 }}><span>Belgi</span><input className="input" maxLength={3} value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} placeholder="U" /></label>
        <label className="field" style={{ width: 120 }}><span>Rang</span><input className="input" type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} style={{ padding: 4, height: 48 }} /></label>
      </div>
      <div className="field"><span>Holat</span><div className="row" style={{ gap: 8 }}>{(['on', 'msg', 'off'] as const).filter((s) => !(f.provider === 'card' && s === 'msg')).map((s) => <Chip key={s} on={f.status === s} onClick={() => setF({ ...f, status: s })}>{{ on: 'Faol', msg: 'Xizmat xabari', off: 'O‘chiq' }[s]}</Chip>)}</div></div>
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={f.name.trim().length < 2 || f.code.length < 2} onClick={save}>Saqlash</Btn>
    </Modal>
  );
}

function Methods() {
  const mq = useApi<{ items: Method[]; providers: { key: string; label: string }[] }>('/admin/payments/methods');
  const cq = useApi<{ items: Card[]; instruction: string }>('/admin/payments/cards');
  const [form, setForm] = useState<null | 'new' | Method>(null);
  const [cardForm, setCardForm] = useState(false);
  const [card, setCard] = useState({ number: '', holder: '', bank: '' });
  const [instr, setInstr] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | { text: string; run: () => Promise<unknown> }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => { if (cq.data && instr === null) setInstr(cq.data.instruction); }, [cq.data]);
  const act = async (key: string, fn: () => Promise<unknown>, ok: string, reload: () => void) => { setBusy(key); try { await fn(); toast(ok); reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); } };
  return (
    <div className="ap-two">
      <div className="card col" style={{ padding: 20, gap: 12 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>To‘lov usullari</b><span className="c2 t-small">Har biri alohida modul – yoqish, o‘chirish, tahrirlash.</span></span>
          <button className="btn btn-inverse btn-sm" onClick={() => setForm('new')}><Icon n="add" size={18} />Usul qo‘shish</button>
        </div>
        <Async q={mq}>
          {(d) => (
            <div className="col" style={{ gap: 10 }}>
              {d.items.map((m) => (
                <div key={m.id} className="col" style={{ gap: 10, padding: 12, borderRadius: 16, boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                  <div className="row wrap" style={{ gap: 12 }}>
                    <span className="pay-tile" style={{ background: m.color ?? 'var(--surface-2)' }}>{m.badge ?? m.name[0]}</span>
                    <button className="col grow" style={{ minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'var(--text-1)', cursor: 'pointer' }} onClick={() => setForm(m)} aria-label={`${m.name} ni tahrirlash`}><b style={{ fontSize: 15 }}>{m.name}</b><span className="c2 t-cap">{m.description ?? (m.kind === 'manual' ? 'Qo‘lda · chek + admin tekshiruvi' : 'Avtomatik · API keyin ulanadi')}</span></button>
                    <div className="seg" style={{ flexShrink: 0 }}>{(['on', 'msg', 'off'] as const).filter((s) => !(m.provider === 'card' && s === 'msg')).map((s) => <button key={s} className={m.status === s ? 'on' : ''} disabled={busy === m.id} onClick={() => act(m.id, () => patch(`/admin/payments/methods/${m.id}`, { status: s }), `${m.name}: ${{ on: 'faol', msg: 'xizmat xabari', off: 'o‘chiq' }[s]}`, mq.reload)}>{{ on: 'Faol', msg: 'Xizmat xabari', off: 'O‘chiq' }[s]}</button>)}</div>
                    <button className="icon-btn ghost" aria-label={`${m.name} ni o‘chirish`} title="Butunlay olib tashlash" onClick={() => setAsk({ text: `«${m.name}» to‘lov usulini butunlay olib tashlaysizmi? Eski to‘lovlar tarixda qoladi.`, run: () => del(`/admin/payments/methods/${m.id}`).then(mq.reload) })}><Icon n="delete" style={{ color: 'var(--error)' }} /></button>
                  </div>
                  {m.status === 'msg' && <div className="row pay-alert"><Icon n="info" size={18} /><span>Bosilganda: “{SERVICE_DOWN}”</span></div>}
                </div>
              ))}
            </div>
          )}
        </Async>
      </div>

      <div className="card col" style={{ padding: 20, gap: 12 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>Kartalar</b><span className="c2 t-small">Botda ham: /cards · /addcard · /setcard</span></span>
          <button className="btn btn-inverse btn-sm" onClick={() => setCardForm(true)}><Icon n="add" size={18} />Karta qo‘shish</button>
        </div>
        <Async q={cq} empty={(d) => !d.items.length && <Empty icon="credit_card" title="Karta yo‘q" text="Karta qo‘shilmaguncha foydalanuvchilar karta orqali to‘lay olmaydi." />}>
          {(d) => (
            <div className="col" style={{ gap: 10 }}>
              {d.items.map((k) => {
                const shown = k.primary && k.active;
                return (
                  <div key={k.id} className="row wrap" style={{ gap: 12, padding: 12, borderRadius: 16, opacity: k.active ? 1 : 0.55, boxShadow: shown ? 'inset 0 0 0 2px var(--brand-ink)' : 'inset 0 0 0 1px var(--border)' }}>
                    <button role="radio" aria-checked={shown} aria-label={`${k.masked} ni foydalanuvchiga ko‘rsatish`} disabled={!k.active || busy === k.id} onClick={() => act(k.id, () => patch(`/admin/payments/cards/${k.id}`, { primary: true }), `${k.masked} endi ko‘rsatiladi`, cq.reload)} style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: shown ? '7px solid var(--brand-ink)' : '2px solid var(--border-strong)', background: 'transparent', cursor: k.active ? 'pointer' : 'not-allowed', padding: 0 }} />
                    <span className="col grow" style={{ minWidth: 0 }}><span className="mono" style={{ fontSize: 15 }}>{k.masked}</span><span className="c2 t-cap">{k.bank} · {k.holder}{!k.active ? ' · faolsiz' : shown ? ' · ko‘rsatilmoqda' : ''}</span></span>
                    <Btn className="btn btn-outline btn-sm" loading={busy === k.id} onClick={() => act(k.id, () => patch(`/admin/payments/cards/${k.id}`, { active: !k.active }), k.active ? 'Karta faolsizlantirildi' : 'Karta faollashtirildi', cq.reload)}>{k.active ? 'Faolsizlantirish' : 'Faollashtirish'}</Btn>
                    <button className="icon-btn ghost" aria-label={`${k.masked} ni o‘chirish`} onClick={() => setAsk({ text: `${k.masked} kartasini ro‘yxatdan olib tashlaysizmi?`, run: () => del(`/admin/payments/cards/${k.id}`).then(cq.reload) })}><Icon n="delete" style={{ color: 'var(--error)' }} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </Async>
        <label className="field"><span>To‘lov yo‘riqnomasi (foydalanuvchiga ko‘rinadi)</span><textarea className="input" rows={5} value={instr ?? ''} onChange={(e) => setInstr(e.target.value)} style={{ resize: 'vertical', minHeight: 120, lineHeight: 1.5 }} /></label>
        <Btn className="btn btn-primary" style={{ alignSelf: 'flex-end' }} loading={busy === 'instr'} disabled={!instr || instr === cq.data?.instruction} onClick={() => act('instr', () => put('/admin/payments/instruction', { text: instr }), 'Yo‘riqnoma saqlandi', cq.reload)}>Yo‘riqnomani saqlash</Btn>
      </div>

      {form && mq.data && <MethodForm m={form === 'new' ? undefined : form} providers={mq.data.providers} onClose={() => setForm(null)} onDone={mq.reload} />}
      {cardForm && (
        <Modal open onClose={() => setCardForm(false)} title="Karta qo‘shish">
          <label className="field"><span>Karta raqami</span><input className="input mono" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '') })} placeholder="8600 1234 5678 4417" /></label>
          <label className="field"><span>Karta egasi</span><input className="input" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="FOOG MCHJ · A. Karimov" /></label>
          <label className="field"><span>Bank</span><input className="input" value={card.bank} onChange={(e) => setCard({ ...card, bank: e.target.value })} placeholder="Uzcard · Kapitalbank" /></label>
          <Btn className="btn btn-primary btn-block" loading={busy === 'card'} disabled={card.number.replace(/\D/g, '').length < 16 || card.holder.trim().length < 2 || card.bank.trim().length < 2} onClick={() => act('card', () => post('/admin/payments/cards', card).then(() => { setCardForm(false); setCard({ number: '', holder: '', bank: '' }); }), 'Karta qo‘shildi', cq.reload)}>Saqlash</Btn>
        </Modal>
      )}
      {ask && (
        <Modal open onClose={() => setAsk(null)} title="Tasdiqlang">
          <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{ask.text}</p>
          <div className="row" style={{ gap: 8 }}><button className="btn btn-outline grow" onClick={() => setAsk(null)}>Bekor qilish</button><Btn className="btn btn-danger grow" loading={busy === 'ask'} onClick={() => act('ask', ask.run, 'O‘chirildi', () => setAsk(null))}>O‘chirish</Btn></div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Bloklar va jurnal ----------------
function Blocks({ onChange }: { onChange: () => void }) {
  const bq = useApi<{ items: { id: string; user: { id: string; name: string; avatarUrl: string | null; phone: string | null }; reason: string; endsAt: string; startedT: string; endsT: string }[] }>('/admin/payments/blocks');
  const aq = useApi<{ items: { id: string; atT: string; who: string; text: string }[] }>('/admin/payments/audit');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const left = (iso: string) => { const ms = new Date(iso).getTime() - Date.now(); const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4); return `${h} s ${String(m).padStart(2, '0')} d`; };
  const lift = async (id: string, name: string) => { setBusy(id); try { await post(`/admin/payments/blocks/${id}/lift`); toast(`${name} blokdan chiqarildi`); bq.reload(); aq.reload(); onChange(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); } };
  return (
    <div className="ap-two">
      <div className="card col" style={{ padding: 20, gap: 12 }}>
        <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>Bloklangan hisoblar</b><span className="c2 t-small">24 soat tugagach blok avtomatik olinadi.</span></span>
        <Async q={bq} empty={(d) => !d.items.length && <span className="c3 t-small">Bloklangan hisob yo‘q.</span>}>
          {(d) => (
            <div className="col">
              {d.items.map((b) => (
                <div key={b.id} className="row wrap" style={{ gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                  <Avatar name={b.user.name} url={b.user.avatarUrl} size={40} />
                  <span className="col grow" style={{ minWidth: 0 }}><b style={{ fontSize: 15 }}>{b.user.name}</b><span className="c2 t-cap">{b.reason} · {b.startedT} → {b.endsT}</span></span>
                  <span className="col" style={{ alignItems: 'flex-end' }}><span className="mono" style={{ fontSize: 14 }}>{left(b.endsAt)}</span><span className="c3 t-cap">qoldi</span></span>
                  <Btn className="btn btn-outline btn-sm" loading={busy === b.id} onClick={() => lift(b.id, b.user.name)}>Blokdan chiqarish</Btn>
                </div>
              ))}
            </div>
          )}
        </Async>
      </div>
      <div className="card col" style={{ padding: 20, gap: 8 }}>
        <b style={{ fontSize: 18 }}>Admin qarorlari jurnali</b>
        <Async q={aq} empty={(d) => !d.items.length && <span className="c3 t-small">Hali qaror yo‘q.</span>}>
          {(d) => (
            <div className="col">
              {d.items.map((a) => (
                <div key={a.id} className="row" style={{ gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}>
                  <span className="mono c3" style={{ fontSize: 12, width: 92, flexShrink: 0, paddingTop: 2 }}>{a.atT}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.45 }}><b>{a.who}</b> <span className="c2">{a.text}</span></span>
                </div>
              ))}
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}

export default function AdminPayments() {
  const [tab, setTab] = useState<'req' | 'tariff' | 'methods' | 'blocks'>('req');
  const badges = useApi<{ review: number }>('/admin/payments/badges');
  const blocks = useApi<{ items: unknown[] }>('/admin/payments/blocks');
  const reload = () => { badges.reload(); blocks.reload(); };
  const tabs = [['req', 'To‘lov so‘rovlari', 'receipt_long', badges.data?.review], ['tariff', 'Tarif va limit', 'tune'], ['methods', 'To‘lov usullari', 'account_balance_wallet'], ['blocks', 'Bloklar', 'block', blocks.data?.items.length]] as const;
  return (
    <>
      <AdminHeader title="Jamoalar va to‘lovlar" />
      <div className="row wrap" style={{ gap: 8 }}>
        {tabs.map(([k, t, icon, n]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)} style={{ minHeight: 44 }}>
            <Icon n={icon} size={18} />{t}{!!n && <span className="badge-n">{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'req' ? <Requests onChange={reload} /> : tab === 'tariff' ? <Tariff /> : tab === 'methods' ? <Methods /> : <Blocks onChange={reload} />}
    </>
  );
}
