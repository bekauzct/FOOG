'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Btn, Empty, Icon, Modal } from '@/components/ui';
import { UpcomingDate } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import { post } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useEvent } from '@/lib/session';
import { BOOKING_STATUS, DOW, SIZE_LABEL, ago, dayMonth, sum, weekday, relDay } from '@/lib/format';

type B = {
  id: string; code: string; date: string; start: string; end: string; price: number; status: string; rejectReason: string | null; createdAt: string;
  pitch: { id: string; name: string; size: string }; stadium: { id: string; name: string; address: string; district: string; lat: number; lng: number; phone: string | null; photo: string | null };
  reviewed: boolean; match: { id: string; title: string } | null; disputed: boolean;
};

function Stars({ v, onChange, label }: { v: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="row between" style={{ gap: 12 }}>
      <span className="c2 t-small">{label}</span>
      <div className="row" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={v === n} onClick={() => onChange(n)} className="icon-btn ghost sm" style={{ width: 36, height: 36 }}><Icon n="star" fill={n <= v} size={22} style={{ color: n <= v ? 'var(--warning)' : 'var(--text-3)' }} /></button>)}</div>
    </div>
  );
}

function ReviewModal({ b, onClose, onDone }: { b: B | null; onClose: () => void; onDone: () => void }) {
  const [r, setR] = useState({ rating: 5, rPitch: 5, rFacilities: 5, rValue: 5, rBooking: 5 });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!b) return null;
  const send = async () => {
    setBusy(true);
    try { await post(`/bookings/${b.id}/review`, { ...r, text }); toast('Sharh uchun rahmat!'); onDone(); onClose(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${b.stadium.name} – sharh`}>
      <Stars v={r.rating} onChange={(n) => setR({ ...r, rating: n })} label="Umumiy baho" />
      <Stars v={r.rPitch} onChange={(n) => setR({ ...r, rPitch: n })} label="Maydon sifati" />
      <Stars v={r.rFacilities} onChange={(n) => setR({ ...r, rFacilities: n })} label="Qulayliklar" />
      <Stars v={r.rValue} onChange={(n) => setR({ ...r, rValue: n })} label="Narx" />
      <Stars v={r.rBooking} onChange={(n) => setR({ ...r, rBooking: n })} label="Bron jarayoni" />
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Maydon, kiyinish xonasi, xodimlar haqida yozing…" maxLength={1000} />
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={text.trim().length < 3} onClick={send}>Sharhni yuborish</Btn>
    </Modal>
  );
}

function DisputeModal({ b, onClose, onDone }: { b: B | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!b) return null;
  const send = async () => {
    setBusy(true);
    try { await post(`/bookings/${b.id}/dispute`, { reason: text }); toast('Nizo ochildi. FOOG moderatori ko‘rib chiqadi.'); onDone(); onClose(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="«Kelmadi» belgisiga e’tiroz">
      <p className="c2 t-small">{b.stadium.name} sizni {dayMonth(b.date)} {b.start} dagi bron bo‘yicha «Kelmadi» deb belgiladi. Agar kelgan bo‘lsangiz, nima bo‘lganini yozing – admin ikkala tomonni tekshiradi.</p>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Masalan: 19:55 da keldim, administrator bilan gaplashdim…" maxLength={500} />
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={text.trim().length < 5} onClick={send}>Nizo ochish</Btn>
    </Modal>
  );
}

function BookingCard({ b, onChange }: { b: B; onChange: () => void }) {
  const [label, tone] = BOOKING_STATUS[b.status] ?? [b.status, 'muted'];
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [dispute, setDispute] = useState(false);
  const toast = useToast();
  const cancel = async () => {
    setBusy(true);
    try { await post(`/bookings/${b.id}/cancel`); toast('Bron bekor qilindi'); setConfirm(false); onChange(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const active = b.status === 'pending' || b.status === 'confirmed';
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between" style={{ gap: 8 }}>
        <span className={`pill-tag ${tone}`}>{label}</span>
        <span className="mono c3" style={{ fontSize: 12 }}>#{b.code}</span>
      </div>
      <div className="row" style={{ gap: 14 }}>
        <UpcomingDate date={b.date} />
        <div className="col grow" style={{ gap: 2 }}>
          <Link href={`/stadiums/${b.stadium.id}`} className="ellipsis" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>{b.stadium.name} · {b.pitch.name}</Link>
          <span className="mono c2" style={{ fontSize: 13 }}>{relDay(b.date).includes('-') ? DOW[weekday(b.date)] : relDay(b.date)}, {b.start}–{b.end} · {SIZE_LABEL[b.pitch.size]}</span>
          <span className="mono" style={{ fontSize: 13 }}>{sum(b.price)} <span className="c2" style={{ fontFamily: 'var(--font-ui)' }}>· to‘lov stadionda</span></span>
        </div>
      </div>
      {b.status === 'pending' && <div className="row well" style={{ padding: '10px 12px', gap: 8, fontSize: 13, color: 'var(--warning)' }}><Icon n="hourglass_top" size={18} />Stadion javobini kutmoqda · {ago(b.createdAt)} yuborilgan. 2 soatda javob bo‘lmasa avtomatik bekor bo‘ladi.</div>}
      {b.status === 'rejected' && b.rejectReason && <div className="row well c2" style={{ padding: '10px 12px', gap: 8, fontSize: 13 }}><Icon n="info" size={18} />Sabab: {b.rejectReason}</div>}
      {b.status === 'expired' && <div className="row well c2" style={{ padding: '10px 12px', gap: 8, fontSize: 13 }}><Icon n="timer_off" size={18} />Stadion 2 soat ichida javob bermadi – avtomatik bekor qilindi.</div>}
      {b.status === 'no_show' && b.disputed && <div className="row well" style={{ padding: '10px 12px', gap: 8, fontSize: 13, color: 'var(--accent)' }}><Icon n="gavel" size={18} />Nizo ochilgan – admin ko‘rib chiqmoqda.</div>}
      {b.match && <Link href={`/matches/${b.match.id}`} className="row well" style={{ padding: '10px 12px', gap: 8, fontSize: 13, color: 'var(--text-1)' }}><Icon n="sports_soccer" size={18} style={{ color: 'var(--brand-ink)' }} />O‘yin: <b>{b.match.title}</b><Icon n="chevron_right" size={18} style={{ marginLeft: 'auto' }} /></Link>}
      <div className="row wrap" style={{ gap: 8 }}>
        {active && <a className="btn btn-outline btn-sm" href={`https://yandex.uz/maps/?rtext=~${b.stadium.lat},${b.stadium.lng}&rtt=auto`} target="_blank" rel="noopener noreferrer"><Icon n="directions" size={18} />Yo‘nalish</a>}
        {active && b.stadium.phone && <a className="btn btn-outline btn-sm" href={`tel:${b.stadium.phone.replace(/\s/g, '')}`}><Icon n="call" size={18} />Qo‘ng‘iroq</a>}
        {active && !b.match && <Link className="btn btn-outline btn-sm" href={`/discover?tab=players`}><Icon n="group_add" size={18} />O‘yinchi taklif qilish</Link>}
        {b.status === 'arrived' && !b.reviewed && <button className="btn btn-primary btn-sm" onClick={() => setReview(true)}><Icon n="star" size={18} />Sharh qoldirish</button>}
        {b.status === 'no_show' && !b.disputed && <button className="btn btn-outline btn-sm" onClick={() => setDispute(true)}><Icon n="gavel" size={18} />E’tiroz bildirish</button>}
        {['rejected', 'expired', 'cancelled'].includes(b.status) && <Link className="btn btn-outline btn-sm" href={`/stadiums/${b.stadium.id}`}><Icon n="refresh" size={18} />Qayta bron qilish</Link>}
        {active && <button className="btn btn-danger-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setConfirm(true)}>Bekor qilish</button>}
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'color-mix(in oklch,var(--error) 18%,transparent)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="event_busy" /></div>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>Bronni bekor qilasizmi?</h3>
        <p className="c2 t-small">{dayMonth(b.date)}, {b.start} · {b.stadium.name}. Stadionga darhol xabar boradi. Iltimos, kamida 24 soat oldin bekor qiling.</p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setConfirm(false)}>Qoldirish</button><Btn className="btn btn-danger" loading={busy} onClick={cancel}>Bekor qilish</Btn></div>
      </Modal>
      <ReviewModal b={review ? b : null} onClose={() => setReview(false)} onDone={onChange} />
      <DisputeModal b={dispute ? b : null} onClose={() => setDispute(false)} onDone={onChange} />
    </div>
  );
}

export default function BookingsPage() {
  const q = useApi<{ upcoming: B[]; past: B[] }>('/bookings/my');
  const [tab, setTab] = useState<'up' | 'past'>('up');
  useEvent('booking', () => q.reload());
  return (
    <div className="page-narrow col" data-tour="list" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div className="col" style={{ gap: 4 }}><div className="label">Toshkent · to‘lov stadionda</div><h1 className="t-page">Bronlarim</h1></div>
        <Link href="/stadiums" className="btn btn-primary"><Icon n="add" />Yangi bron</Link>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'up'} className={`tab ${tab === 'up' ? 'on' : ''}`} onClick={() => setTab('up')}>Kelgusi <span className="n">{q.data?.upcoming.length ?? 0}</span></button>
        <button role="tab" aria-selected={tab === 'past'} className={`tab ${tab === 'past' ? 'on' : ''}`} onClick={() => setTab('past')}>Tarix <span className="n">{q.data?.past.length ?? 0}</span></button>
      </div>
      <Async q={q} empty={(d) => !(tab === 'up' ? d.upcoming : d.past).length && (
        <div className="card"><Empty icon="event_available" title={tab === 'up' ? 'Kelgusi bron yo‘q' : 'Tarix bo‘sh'} text={tab === 'up' ? 'Stadion tanlang, vaqtni belgilang va so‘rov yuboring – stadion tasdiqlaydi.' : 'O‘ynagan o‘yinlaringiz shu yerda saqlanadi.'} action={<Link href="/stadiums" className="btn btn-primary btn-sm">Stadion topish</Link>} /></div>
      )}>
        {(d) => <div className="col" style={{ gap: 12 }}>{(tab === 'up' ? d.upcoming : d.past).map((b) => <BookingCard key={b.id} b={b} onChange={q.reload} />)}</div>}
      </Async>
    </div>
  );
}
