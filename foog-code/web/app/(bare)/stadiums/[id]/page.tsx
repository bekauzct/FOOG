'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import FoogMark from '@/components/FoogMark';
import { ThemeButton } from '@/components/TopBar';
import { Avatar, Btn, ErrorState, Icon, Modal, Skeleton } from '@/components/ui';
import { ShareSheet } from '@/components/social';
import { useApi } from '@/lib/useApi';
import { ApiError, post } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { AMENITY, DOW, MONTHS, addDays, dayMonth, dec, sum, todayStr, weekday, SIZE_LABEL, SURFACE_LABEL, minutesLabel, tashkent } from '@/lib/format';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="skel" style={{ width: '100%', height: '100%' }} /> });

type Pitch = { id: string; name: string; size: string; surface: string; indoor: boolean; price: number; peakPrice: number; peakFrom: number; note: string | null };
type Detail = {
  id: string; name: string; address: string; district: string; lat: number; lng: number; phone: string | null; description: string | null; metro: string | null;
  amenities: string[]; cancelPolicy: string; status: string; accepting: boolean; partner: boolean; photos: { id: string; url: string; caption: string | null }[]; saved: boolean;
  lightsUntil: string; distanceKm: number; pitches: Pitch[];
  rating: { avg: number | null; count: number; pitch: number | null; facilities: number | null; value: number | null; booking: number | null };
  reviews: { id: string; rating: number; text: string; reply: string | null; createdAt: string; user: { id: string; name: string; avatarUrl: string | null; username: string } }[];
  similar: { id: string; name: string; photo: string | null; distanceKm: number; price: number; size: string; indoor: boolean; surface: string }[];
};
type Slot = { hour: number; time: string; state: 'free' | 'booked' | 'pending' | 'blocked' | 'past' | 'closed'; price: number; peak: boolean };
type Slots = { date: string; pitches: (Pitch & { slots: Slot[] })[] };
type Booking = { id: string; code: string; date: string; start: string; end: string; price: number; pitch?: { name: string } };

const pad = (n: number) => String(n).padStart(2, '0');
const toIcsDate = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

function downloadIcs(b: Booking, st: Detail, pitch: string) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FOOG//UZ', 'BEGIN:VEVENT', `UID:${b.code}@foog.uz`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Tashkent:${toIcsDate(b.date, b.start)}`, `DTEND;TZID=Asia/Tashkent:${toIcsDate(b.end === '00:00' ? addDays(b.date, 1) : b.date, b.end)}`,
    `SUMMARY:Futbol · ${st.name}, ${pitch}`, `LOCATION:${st.address}`, `DESCRIPTION:Bron ${b.code}. To‘lov stadionda: ${sum(b.price)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${b.code}.ics`;
  a.click();
}

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { me } = useSession();
  const toast = useToast();
  const st = useApi<Detail>(`/stadiums/${id}`);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i)), []);
  const [date, setDate] = useState(sp.get('date') && days.includes(sp.get('date')!) ? sp.get('date')! : days[0]);
  const [hour, setHour] = useState<number | null>(sp.get('time') ? Number(sp.get('time')!.slice(0, 2)) : null);
  const [mins, setMins] = useState(60);
  const [pitchId, setPitchId] = useState<string | null>(null);
  const slots = useApi<Slots>(`/stadiums/${id}/slots?date=${date}`, [date]);
  const [sheet, setSheet] = useState<null | 'summary' | 'success'>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);
  const [saved, setSaved] = useState(false);
  const [share, setShare] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  useEffect(() => { if (st.data) setSaved(st.data.saved); }, [st.data?.id]);

  // Tanlangan soatda (davomiylik bilan) bo‘sh maydonlar
  const P = slots.data?.pitches ?? [];
  const steps = mins / 60;
  const free = (p: Slots['pitches'][0], h: number) => Array.from({ length: Math.ceil(steps) }, (_, k) => p.slots.find((s) => s.hour === h + k)?.state === 'free').every(Boolean);
  const hoursList = Array.from({ length: 16 }, (_, i) => 8 + i).filter((h) => P.some((p) => p.slots.find((s) => s.hour === h)?.state !== 'closed'));
  const anyFree = (h: number) => P.some((p) => free(p, h));
  useEffect(() => { if (hour !== null && slots.data && !anyFree(hour)) setHour(null); }, [slots.data, mins]);
  useEffect(() => { if (pitchId && hour !== null) { const p = P.find((x) => x.id === pitchId); if (!p || !free(p, hour)) setPitchId(null); } }, [hour, mins, slots.data]);
  const pitch = P.find((p) => p.id === pitchId);
  const price = pitch && hour !== null ? Array.from({ length: mins / 30 }, (_, k) => (Math.floor(hour + k / 2) >= pitch.peakFrom ? pitch.peakPrice : pitch.price) / 2).reduce((a, b) => a + b, 0) : 0;
  const ready = hour !== null && !!pitch;
  const endT = hour !== null ? (() => { const m = hour * 60 + mins; return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; })() : '';
  const freeToday = P.reduce((n, p) => n + p.slots.filter((s) => s.state === 'free').length, 0);

  const confirm = async () => {
    if (!me) return router.push(`/login?next=${encodeURIComponent(`/stadiums/${id}?date=${date}&time=${pad(hour ?? 0)}:00`)}`);
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      const b = await post<Booking>('/bookings', { pitchId, date, start: `${pad(hour!)}:00`, minutes: mins, sourceReelId: sp.get('reel') ?? undefined });
      setDone(b);
      setSheet('success');
      setHour(null); setPitchId(null);
      slots.reload();
    } catch (e) {
      setErr((e as Error).message);
      if (e instanceof ApiError && (e.code === 'slot_taken' || e.code === 'slot_locked')) { slots.reload(); }
    } finally { setBusy(false); }
  };
  const toggleSave = async () => {
    if (!me) return router.push('/login');
    setSaved((v) => !v);
    try { const r = await post<{ saved: boolean }>(`/stadiums/${id}/save`); setSaved(r.saved); toast(r.saved ? 'Saqlanganlarga qo‘shildi' : 'Saqlanganlardan olib tashlandi'); } catch { setSaved((v) => !v); }
  };

  if (st.error && !st.data) return <><Header /><ErrorState error={st.error} onRetry={st.reload} /></>;
  const d = st.data;
  const firstPitch = d?.pitches[0];
  const sizes = d ? [...new Set(d.pitches.map((p) => SIZE_LABEL[p.size]))].join(' / ') : '';
  const specs: [string, string][] = d ? [
    ['Format', `${sizes} · ${d.pitches.length} ta maydon`], ['O‘lcham', d.pitches.some((p) => p.size === '11x11') ? '105 × 68 m' : d.pitches.some((p) => p.size === '7x7') ? '40 × 20 m' : '30 × 15 m'],
    ['Qoplama', [...new Set(d.pitches.map((p) => SURFACE_LABEL[p.surface]))].join(', ')], ['Joylashuv', d.pitches.every((p) => p.indoor) ? 'Yopiq · tomli' : d.pitches.some((p) => p.indoor) ? 'Yopiq va ochiq' : 'Ochiq'],
    ['Yoritish', `LED · ${d.lightsUntil} gacha`], ['Darvoza', d.pitches.some((p) => p.size === '11x11') ? '7,32 × 2,44 m' : '3 × 2 m'],
  ] : [];
  const reviews = d ? (allReviews ? d.reviews : d.reviews.slice(0, 2)) : [];
  const now = tashkent();

  return (
    <div style={{ paddingBottom: 96 }}>
      <Header saved={saved} onSave={toggleSave} onShare={() => setShare(true)} />
      <div style={{ maxWidth: 1168, margin: '0 auto', padding: '20px 24px 0' }} className="sd-wrap">
        {/* Galereya */}
        <div className="sd-gal">
          {!d ? <Skeleton h={356} r={20} style={{ gridColumn: '1/-1' }} /> : (
            <>
              <button className="sd-hero ph" onClick={() => setGallery(true)} style={{ background: d.photos[0] ? `center/cover url("${d.photos[0].url}")` : undefined }} aria-label="Rasmlarni ko‘rish" />
              {d.photos.slice(1, 5).map((p, i) => (
                <button key={p.id} className="sd-thumb ph hide-mobile" onClick={() => setGallery(true)} style={{ background: `center/cover url("${p.url}")`, position: 'relative' }} aria-label={p.caption ?? 'Rasm'}>
                  {i === 3 && <span className="row" style={{ position: 'absolute', right: 12, bottom: 12, gap: 6, height: 36, padding: '0 12px', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-1)', fontSize: 13, fontWeight: 600 }}><Icon n="photo_library" size={18} />Barcha {d.photos.length} rasm</span>}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="sd-main">
          <div className="col" style={{ gap: 32, minWidth: 0 }}>
            {!d ? <div className="col" style={{ gap: 12, marginTop: 24 }}><Skeleton h={40} w="60%" /><Skeleton h={18} w="80%" /><Skeleton h={120} /></div> : (
              <>
                <div className="col" style={{ gap: 12, marginTop: 24 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className={`pill-tag ${freeToday > 3 ? 'success' : freeToday ? 'warning' : 'error'}`}><span className="dot" />{date === todayStr() ? `Bugun ${freeToday} ta bo‘sh soat` : `${freeToday} ta bo‘sh soat`}</span>
                    {d.partner && <span className="pill-tag" style={{ boxShadow: 'inset 0 0 0 1px var(--border-strong)', color: 'var(--text-2)' }}><Icon n="verified" fill size={14} style={{ color: 'var(--accent)' }} />FOOG hamkori</span>}
                    {d.status !== 'live' && <span className="pill-tag warning">Moderatsiyada · faqat siz ko‘rasiz</span>}
                  </div>
                  <h1 className="t-h1">{d.name}</h1>
                  <div className="row wrap" style={{ gap: 12, fontSize: 15 }}>
                    {d.rating.avg != null && <span className="row mono" style={{ gap: 4 }}><Icon n="star" fill size={18} style={{ color: 'var(--brand-ink)' }} />{dec(d.rating.avg)} · <span className="c2">{d.rating.count} ta sharh</span></span>}
                    <span className="c2">{d.address}</span><span className="c2">{dec(d.distanceKm)} km uzoqlikda</span>
                  </div>
                </div>

                <div className="sd-specs">
                  {specs.map(([k, v]) => <div key={k} className="col" style={{ padding: '14px 16px', gap: 4, background: 'var(--surface)' }}><span className="label-sm c3">{k}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{v}</span></div>)}
                </div>

                {d.description && <section className="col" style={{ gap: 12 }}><h2 style={{ fontSize: 22, fontWeight: 700 }}>Stadion haqida</h2><p className="c2" style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 640 }}>{d.description}</p></section>}

                {!!d.amenities.length && (
                  <section className="col" style={{ gap: 12 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>Qulayliklar</h2>
                    <div className="sd-amen">{d.amenities.map((a) => AMENITY[a] && <div key={a} className="row" style={{ gap: 12, height: 52, padding: '0 16px', borderRadius: 14, boxShadow: 'inset 0 0 0 1px var(--border)', fontSize: 15 }}><Icon n={AMENITY[a][0]} size={22} />{AMENITY[a][1]}</div>)}</div>
                  </section>
                )}

                <section className="col" style={{ gap: 12 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700 }}>Manzil</h2>
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ height: 220 }}><MapView pins={[{ id: d.id, lat: d.lat, lng: d.lng, label: '', icon: 'stadium' }]} center={[d.lat, d.lng]} zoomControl={false} /></div>
                    <div className="row between wrap" style={{ padding: '14px 20px', gap: 12, fontSize: 14 }}>
                      <span>{d.metro && <><b>Metro: {d.metro}</b> · </>}<span className="c2">{d.address}</span></span>
                      <a className="btn btn-outline btn-sm" href={`https://yandex.uz/maps/?rtext=~${d.lat},${d.lng}&rtt=auto`} target="_blank" rel="noopener noreferrer"><Icon n="directions" size={18} />Yo‘nalish</a>
                    </div>
                  </div>
                </section>

                <section className="col" style={{ gap: 12 }}>
                  <div className="row between"><h2 style={{ fontSize: 22, fontWeight: 700 }}>Sharhlar</h2>{d.reviews.length > 2 && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setAllReviews((v) => !v)}>{allReviews ? 'Kamroq' : `Hammasi · ${d.rating.count}`}</button>}</div>
                  {!d.rating.count ? <div className="card c2" style={{ padding: 20, fontSize: 15 }}>Hali sharh yo‘q. O‘ynab bo‘lgach, birinchi sharhni qoldiring.</div> : (
                    <>
                      <div className="card sd-rate">
                        <div className="col"><span className="mono" style={{ fontSize: 48, lineHeight: '52px', fontWeight: 500 }}>{dec(d.rating.avg)}</span><span className="c2 t-small">{d.rating.count} ta tasdiqlangan bron</span></div>
                        <div className="col" style={{ gap: 6, flex: 1 }}>
                          {([['Maydon sifati', d.rating.pitch], ['Qulayliklar', d.rating.facilities], ['Narx', d.rating.value], ['Bron jarayoni', d.rating.booking]] as const).map(([k, v]) => (
                            <div key={k} className="row" style={{ gap: 14, fontSize: 14 }}><span className="c2" style={{ width: 120 }}>{k}</span><div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)' }}><div style={{ width: `${((v ?? 0) / 5) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} /></div><span className="mono" style={{ width: 28, textAlign: 'right' }}>{dec(v)}</span></div>
                          ))}
                        </div>
                      </div>
                      <div className="sd-reviews">
                        {reviews.map((r) => (
                          <div key={r.id} className="card col" style={{ padding: 18, gap: 10 }}>
                            <div className="row" style={{ gap: 12 }}>
                              <Avatar name={r.user.name} url={r.user.avatarUrl} size={36} />
                              <div className="col grow"><b style={{ fontSize: 15 }}>{r.user.name}</b><span className="c2" style={{ fontSize: 13 }}>{MONTHS[Number(r.createdAt.slice(5, 7)) - 1]} {r.createdAt.slice(0, 4)}</span></div>
                              <span className="row mono" style={{ gap: 3, fontSize: 14 }}><Icon n="star" fill size={16} style={{ color: 'var(--brand-ink)' }} />{dec(r.rating)}</span>
                            </div>
                            <p style={{ fontSize: 15, lineHeight: 1.55 }}>{r.text}</p>
                            {r.reply && <div className="well" style={{ padding: '10px 12px', fontSize: 14 }}><b>Stadion javobi:</b> <span className="c2">{r.reply}</span></div>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Bron paneli */}
          <aside id="booking-panel" className="card sd-panel">
            {!d || !firstPitch ? <Skeleton h={420} /> : (
              <>
                <div className="row between wrap" style={{ gap: 8 }}>
                  <div><span className="mono" style={{ fontSize: 26, fontWeight: 500 }}>{sum(pitch ? (hour !== null && hour >= pitch.peakFrom ? pitch.peakPrice : pitch.price) : Math.min(...d.pitches.map((p) => p.price)))}</span><span className="c2 t-small">/soat</span></div>
                  <span className="pill-tag success" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-ui)', fontSize: 13 }}><Icon n="storefront" size={16} />To‘lov stadionda</span>
                </div>
                <div className="col" style={{ gap: 10 }}>
                  <div className="row" style={{ gap: 8, fontWeight: 600 }}><span className="sd-step on">1</span>Sana</div>
                  <div className="sd-days">
                    {days.map((x) => (
                      <button key={x} onClick={() => { setDate(x); setHour(null); setPitchId(null); }} className={`sd-day ${date === x ? 'on' : ''}`} aria-pressed={date === x}>
                        <span className="mono" style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>{DOW[weekday(x)]}</span>
                        <span className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{Number(x.slice(8))}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col" style={{ gap: 10 }}>
                  <div className="row between"><div className="row" style={{ gap: 8, fontWeight: 600 }}><span className={`sd-step ${hour !== null ? 'on' : ''}`}>2</span>Vaqt</div>
                    <div className="seg" style={{ padding: 2 }}>{[60, 90, 120].map((m) => <button key={m} className={mins === m ? 'on' : ''} style={{ height: 30, padding: '0 10px', fontSize: 12 }} onClick={() => setMins(m)}>{minutesLabel(m)}</button>)}</div>
                  </div>
                  {slots.error ? <ErrorState error={slots.error} onRetry={slots.reload} /> : !slots.data ? <Skeleton h={100} /> : !hoursList.length ? <p className="c2 t-small">Bu kuni stadion yopiq.</p> : (
                    <div className="sd-times">
                      {hoursList.map((h) => {
                        const ok = anyFree(h);
                        const peak = P.some((p) => h >= p.peakFrom);
                        const past = date === now.date && h <= now.hour;
                        return (
                          <button key={h} disabled={!ok} onClick={() => setHour(h)} className={`sd-time ${hour === h ? 'on' : ''}`} aria-pressed={hour === h} aria-label={`${pad(h)}:00 ${ok ? 'bo‘sh' : past ? 'o‘tgan' : 'band'}`}>
                            <span style={{ textDecoration: ok ? 'none' : 'line-through' }}>{pad(h)}:00</span>
                            {ok && peak && <span style={{ fontSize: 9, lineHeight: 1, opacity: 0.8 }}>peak</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="col" style={{ gap: 10 }}>
                  <div className="row" style={{ gap: 8, fontWeight: 600 }}><span className={`sd-step ${pitch ? 'on' : ''}`}>3</span>Maydon</div>
                  {P.map((p) => {
                    const ok = hour !== null && free(p, hour);
                    const pr = hour !== null && hour >= p.peakFrom ? p.peakPrice : p.price;
                    return (
                      <button key={p.id} disabled={!ok} onClick={() => setPitchId(p.id)} className="row sd-pitch" aria-pressed={pitchId === p.id}
                        style={{ gap: 12, padding: '10px 14px', minHeight: 52, borderRadius: 14, border: 'none', textAlign: 'left', color: 'var(--text-1)', opacity: hour !== null && !ok ? 0.5 : 1, background: pitchId === p.id ? 'color-mix(in oklch,var(--primary) 12%,var(--bg))' : 'var(--bg)', boxShadow: pitchId === p.id ? 'inset 0 0 0 2px var(--brand-ink)' : 'inset 0 0 0 1px var(--border)' }}>
                        <span className="col grow"><b style={{ fontSize: 15 }}>{p.name} <span className="c2" style={{ fontWeight: 500 }}>· {SIZE_LABEL[p.size]}</span></b><span className="c2" style={{ fontSize: 12 }}>{hour !== null && !ok ? 'Bu vaqtda band' : `${p.note ?? SURFACE_LABEL[p.surface]} · ${sum(pr)}`}</span></span>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', boxShadow: pitchId === p.id ? 'inset 0 0 0 2px var(--brand-ink)' : 'inset 0 0 0 1.5px var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{pitchId === p.id && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-ink)' }} />}</span>
                      </button>
                    );
                  })}
                </div>
                {!d.accepting && <div className="well row" style={{ padding: 12, gap: 8, color: 'var(--warning)', fontSize: 14 }}><Icon n="block" size={20} />Stadion vaqtincha yangi bron qabul qilmayapti</div>}
                <div className="row" style={{ gap: 10 }}>
                  <button className="btn btn-primary btn-lg grow" disabled={!ready || !d.accepting || d.status !== 'live'} onClick={() => { setErr(null); setSheet('summary'); }}>
                    {ready ? `Bronni tasdiqlash · ${sum(price)}` : hour === null ? 'Vaqtni tanlang' : 'Maydonni tanlang'}
                  </button>
                </div>
                <div className="row" style={{ gap: 6, justifyContent: 'center', fontSize: 13, color: 'var(--text-2)' }}><Icon n="event_available" size={16} style={{ color: 'var(--success)' }} />{d.cancelPolicy}</div>
              </>
            )}
          </aside>
        </div>

        {d && !!d.similar.length && (
          <section className="col" style={{ gap: 16, marginTop: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>Yaqin atrofdagi o‘xshash stadionlar</h2>
            <div className="sd-similar">
              {d.similar.map((s) => (
                <Link key={s.id} href={`/stadiums/${s.id}`} className="card" style={{ overflow: 'hidden', color: 'var(--text-1)' }}>
                  <div className="ph" style={{ aspectRatio: '16/10', background: s.photo ? `center/cover url("${s.photo}")` : undefined }} />
                  <div style={{ padding: '14px 16px' }}>
                    <div className="row between" style={{ gap: 8 }}><b className="ellipsis" style={{ fontSize: 15 }}>{s.name}</b><span className="mono" style={{ fontSize: 13, flexShrink: 0 }}>{sum(s.price)}</span></div>
                    <div className="c2" style={{ fontSize: 12 }}>{dec(s.distanceKm)} km · {SIZE_LABEL[s.size]} · {s.indoor ? 'Yopiq' : SURFACE_LABEL[s.surface]}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobil: pastki bron paneli */}
      {d && !sheet && (
        <div className="sd-bar only-mobile">
          <div className="col grow" style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{ready ? `${DOW[weekday(date)]} ${Number(date.slice(8))} · ${pad(hour!)}:00 · ${pitch!.name}` : `${freeToday} ta bo‘sh soat`}</span>
            <span className="c2" style={{ fontSize: 12 }}>To‘lov stadionda</span>
          </div>
          <button className="btn btn-primary" disabled={(ready && !d.accepting)} onClick={() => (ready ? setSheet('summary') : document.getElementById('booking-panel')?.scrollIntoView({ behavior: 'smooth' }))}>{ready ? 'Bronni tasdiqlash' : 'Vaqt tanlash'}</button>
        </div>
      )}

      {/* Bron xulosasi va natija */}
      <Modal open={sheet === 'summary'} onClose={() => !busy && setSheet(null)} title="Bron xulosasi">
        {d && pitch && hour !== null && (
          <>
            <div className="row well" style={{ gap: 14, padding: 14, borderRadius: 16 }}>
              <div className="ph" style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0, background: d.photos[0] ? `center/cover url("${d.photos[0].url}")` : undefined }} />
              <div className="col"><b style={{ fontSize: 17 }}>{d.name} · {pitch.name}</b><span className="mono c2" style={{ fontSize: 14 }}>{dayMonth(date)}, {DOW[weekday(date)]} · {pad(hour)}:00–{endT}</span></div>
            </div>
            <div className="col" style={{ gap: 10, fontSize: 15 }}>
              <div className="row between"><span className="c2">Maydon ijarasi · {minutesLabel(mins)}</span><span className="mono">{sum(price)}</span></div>
              {d.amenities.includes('balls') && <div className="row between"><span className="c2">To‘p va maykalar</span><span className="mono" style={{ color: 'var(--success)' }}>Bepul</span></div>}
              <hr className="divider" />
              <div className="row between" style={{ fontWeight: 700, fontSize: 17 }}><span>Jami</span><span className="mono">{sum(price)}</span></div>
            </div>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'color-mix(in oklch,var(--success) 12%,transparent)' }}>
              <Icon n="storefront" size={22} style={{ color: 'var(--success)' }} />
              <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 15 }}>To‘lov stadionda</b><span className="c2" style={{ fontSize: 13 }}>Naqd yoki karta orqali stadion kassasida. Saytda onlayn to‘lov yo‘q. Stadion so‘rovingizni 2 soat ichida tasdiqlaydi.</span></span>
            </div>
            {err && <div role="alert" className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 14 }}><Icon n="error" size={20} />{err}</div>}
            <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
              <Btn className="btn btn-primary btn-lg grow" loading={busy} onClick={confirm}>{busy ? 'Yuborilmoqda…' : 'Bronni tasdiqlash'}</Btn>
              <span className="row c2" style={{ gap: 4, fontSize: 13 }}><Icon n="payments" size={16} />To‘lov stadionda</span>
            </div>
          </>
        )}
      </Modal>
      <Modal open={sheet === 'success'} onClose={() => setSheet(null)}>
        {done && d && (
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 16, padding: '8px 0' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop .5s var(--kick) both' }}><Icon n="check" size={44} /></div>
            <div className="col" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800 }}>Bron so‘rovi yuborildi</h2>
              <p className="c2" style={{ fontSize: 15 }}>Bron #{done.code} · stadion tasdiqlashini kutmoqda. Javob Telegram va bildirishnomalarga keladi (2 soatgacha).</p>
            </div>
            <div className="well mono" style={{ padding: '10px 14px', fontSize: 14 }}>{dayMonth(done.date)} · {done.start}–{done.end} · {sum(done.price)}</div>
            <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => downloadIcs(done, d, done.pitch?.name ?? '')}><Icon n="calendar_add_on" />Kalendarga qo‘shish</button>
              <button className="btn btn-outline" onClick={() => setMatchOpen(true)}><Icon n="group_add" />O‘yinchilarni taklif qilish</button>
            </div>
            <Link href="/bookings" className="btn btn-inverse btn-block" onClick={() => setSheet(null)}>Tayyor</Link>
          </div>
        )}
      </Modal>
      {done && <CreateMatch open={matchOpen} onClose={() => setMatchOpen(false)} booking={done} stadium={d?.name ?? ''} />}
      {d && <ShareSheet open={share} onClose={() => setShare(false)} url={`/stadiums/${d.id}`} title={`${d.name} – FOOG`} />}
      <Modal open={gallery} onClose={() => setGallery(false)} title={`Rasmlar · ${d?.photos.length ?? 0}`} wide>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>{d?.photos.map((p) => <img key={p.id} src={p.url} alt={p.caption ?? ''} style={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', borderRadius: 12 }} />)}</div>
      </Modal>
    </div>
  );
}

/** Bron asosida ochiq o‘yin yaratish → o‘yinchilarni taklif qilish (Izlash → O‘yinchilar) */
function CreateMatch({ open, onClose, booking, stadium }: { open: boolean; onClose: () => void; booking: Booking; stadium: string }) {
  const [title, setTitle] = useState('');
  const [cap, setCap] = useState(10);
  const [needs, setNeeds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const go = async () => {
    setBusy(true);
    try {
      const m = await post<{ id: string; chatId: string }>('/matches', { bookingId: booking.id, title: title.trim() || `O‘yin · ${stadium}`, capacity: cap, level: 'any', needs });
      toast('O‘yin ochildi. Endi o‘yinchilarni taklif qiling.');
      router.push(`/discover?tab=players&invite=${m.id}`);
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="O‘yin ochish">
      <p className="c2 t-small">Bron asosida ochiq o‘yin yarating – boshqa futbolchilar «Izlash → O‘yinlar» bo‘limida ko‘rib, qo‘shila oladi.</p>
      <label className="field"><span>O‘yin nomi</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`O‘yin · ${stadium}`} /></label>
      <div className="field"><span>O‘yinchilar soni</span><div className="row wrap" style={{ gap: 8 }}>{[8, 10, 12, 14, 22].map((n) => <button key={n} className={`chip ${cap === n ? 'on' : ''}`} onClick={() => setCap(n)}>{n}</button>)}</div><span className="hint">Har biriga: {sum(Math.ceil(booking.price / cap / 1000) * 1000)} · to‘lov stadionda</span></div>
      <div className="field"><span>Kim kerak</span><div className="row wrap" style={{ gap: 8 }}>{['GK', 'DEF', 'MID', 'FWD'].map((n) => <button key={n} className={`chip ${needs.includes(n) ? 'on' : ''}`} onClick={() => setNeeds((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}>{n}</button>)}</div></div>
      <Btn className="btn btn-primary btn-block" loading={busy} onClick={go}>O‘yin ochish</Btn>
    </Modal>
  );
}

function Header({ saved, onSave, onShare }: { saved?: boolean; onSave?: () => void; onShare?: () => void }) {
  const router = useRouter();
  return (
    <header className="row between" style={{ position: 'sticky', top: 0, zIndex: 40, height: 68, padding: '0 20px', background: 'color-mix(in oklch,var(--bg) 92%,transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
      <button className="btn btn-surface btn-sm" onClick={() => (history.length > 1 ? router.back() : router.push('/stadiums'))}><Icon n="arrow_back" size={20} />Stadionlar</button>
      <Link href="/home" className="hide-mobile" style={{ width: 96, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} aria-label="FOOG"><FoogMark ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></Link>
      <div className="row" style={{ gap: 8 }}>
        <ThemeButton />
        {onShare && <button className="icon-btn" onClick={onShare} aria-label="Ulashish"><Icon n="ios_share" size={22} /></button>}
        {onSave && <button className="icon-btn" onClick={onSave} aria-label="Saqlash" aria-pressed={saved}><Icon n="favorite" fill={saved} size={22} style={{ color: saved ? 'var(--error)' : undefined }} /></button>}
      </div>
    </header>
  );
}

export default function StadiumDetailPage() {
  return <Suspense><DetailInner /></Suspense>;
}
