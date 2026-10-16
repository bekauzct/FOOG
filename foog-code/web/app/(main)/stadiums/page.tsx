'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { ErrorState, Icon, Skeleton } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { qs } from '@/lib/api';
import { AMENITY, DISTRICTS, DOW, addDays, dayMonthShort, dec, kSum, relDay, sum, todayStr, weekday, SURFACE_LABEL, SIZE_LABEL, tashkent } from '@/lib/format';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="skel" style={{ width: '100%', height: '100%', borderRadius: 20 }} /> });

type St = {
  id: string; name: string; district: string; address: string; lat: number; lng: number; distanceKm: number; rating: number | null; reviews: number;
  photo: string | null; amenities: string[]; sizes: string[]; surfaces: string[]; indoor: boolean[]; price: number; freeSlots: number; freeAtTime: boolean;
  times: { time: string; free: boolean }[]; saved: boolean;
};
type Res = { date: string; time: string; items: St[] };

const CHIPS: [string, string][] = [['available', 'Hozir bo‘sh'], ['5x5', '5×5'], ['7x7', '7×7'], ['11x11', '11×11'], ['turf', 'Sun’iy o‘t'], ['grass', 'Tabiiy o‘t'], ['indoor', 'Yopiq'], ['outdoor', 'Ochiq']];

function StadiumsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const now = tashkent();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [query, setQuery] = useState(sp.get('q') ?? '');
  const [district, setDistrict] = useState(sp.get('district') ?? '');
  const [date, setDate] = useState(sp.get('date') ?? todayStr());
  const [time, setTime] = useState(sp.get('time') ?? `${String(Math.min(23, Math.max(now.hour + 1, 8))).padStart(2, '0')}:00`);
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [map, setMap] = useState(sp.get('view') === 'map');
  const [hover, setHover] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState<{ lat: number; lng: number } | null>(null);

  const sizes = ['5x5', '7x7', '11x11'].filter((k) => chips[k]);
  const surfaces = ['turf', 'grass'].filter((k) => chips[k]);
  const setting = chips.indoor && !chips.outdoor ? 'indoor' : chips.outdoor && !chips.indoor ? 'outdoor' : undefined;
  const path = `/stadiums${qs({ q: query, district, date, time, size: sizes, surface: surfaces, setting, available: chips.available ? '1' : undefined, maxPrice: maxPrice < 1000000 ? maxPrice : undefined, lat: area?.lat, lng: area?.lng, radius: area ? 4 : undefined })}`;
  const r = useApi<Res>(path);
  const items = r.data?.items ?? [];
  const pins = useMemo(() => items.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: kSum(s.price), dot: s.freeSlots > 3 ? 'var(--success)' : s.freeSlots ? 'var(--warning)' : 'var(--error)', on: hover === s.id })), [items, hover]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i));
  const hours = Array.from({ length: 16 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);
  const clear = () => { setChips({}); setMaxPrice(1000000); setQuery(''); setQ(''); setDistrict(''); setArea(null); };
  const dateLbl = relDay(date).includes('-') ? `${DOW[weekday(date)]}, ${dayMonthShort(date)}` : `${relDay(date)}, ${DOW[weekday(date)]}`;

  return (
    <div>
      <div className="st-bar">
        <form className="st-search" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
          <label className="st-f st-q"><Icon n="search" size={22} style={{ color: 'var(--text-2)' }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stadion nomi yoki tuman" aria-label="Stadion nomi yoki tuman" /></label>
          <label className="st-f"><Icon n="location_on" size={20} style={{ color: 'var(--text-2)' }} /><span className="col grow"><span className="st-k">Joy</span>
            <select value={district} onChange={(e) => { setDistrict(e.target.value); setArea(null); }} aria-label="Tuman"><option value="">Toshkent · hammasi</option>{DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></span></label>
          <label className="st-f"><Icon n="calendar_month" size={20} style={{ color: 'var(--text-2)' }} /><span className="col grow"><span className="st-k">Sana</span>
            <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Sana">{days.map((d) => <option key={d} value={d}>{relDay(d).includes('-') ? `${DOW[weekday(d)]}, ${dayMonthShort(d)}` : `${relDay(d)}, ${DOW[weekday(d)]} ${Number(d.slice(8))}`}</option>)}</select></span></label>
          <label className="st-f"><Icon n="schedule" size={20} style={{ color: 'var(--text-2)' }} /><span className="col grow"><span className="st-k">Vaqt</span>
            <select value={time} onChange={(e) => setTime(e.target.value)} aria-label="Vaqt">{hours.map((h) => <option key={h} value={h}>{h} · 1 soat</option>)}</select></span></label>
          <button className="btn btn-primary" style={{ height: 48, padding: '0 22px' }}><Icon n="search" size={20} />Qidirish</button>
        </form>
        <div className="row scroll-x" style={{ gap: 8 }}>
          {CHIPS.map(([k, l]) => <button key={k} className={`chip ${chips[k] ? 'on' : ''}`} onClick={() => setChips((c) => ({ ...c, [k]: !c[k] }))} aria-pressed={!!chips[k]}>{l}</button>)}
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
          <label className="row" style={{ gap: 8, height: 36, padding: '0 14px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px var(--border-strong)', fontSize: 14, flexShrink: 0 }}>
            <span className="c2">Maks.</span>
            <input type="range" min={150000} max={1000000} step={25000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} style={{ width: 110, accentColor: 'var(--volt)' }} aria-label="Maksimal narx" />
            <span className="mono" style={{ fontSize: 14, minWidth: 120 }}>{maxPrice >= 1000000 ? 'Har qanday' : sum(maxPrice)}</span>
          </label>
        </div>
      </div>

      <div className={`st-grid ${map ? 'with-map' : ''}`}>
        <main className="col" style={{ padding: '20px 24px 80px', gap: 16, minWidth: 0 }}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div className="col" style={{ gap: 2 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.01em' }}>{r.data ? `Toshkentda ${items.length} ta stadion` : 'Stadionlar'}</h1>
              <div className="c2" style={{ fontSize: 14 }}>{dateLbl} · {time} · 1 soat · {area ? 'tanlangan hudud' : 'masofa bo‘yicha'}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="seg"><button className={map ? 'on' : ''} onClick={() => setMap((m) => !m)} aria-pressed={map}><Icon n="map" size={18} />Xarita</button></div>
              <div className="seg hide-mobile">
                <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} title="Panjara" aria-label="Panjara"><Icon n="grid_view" size={20} /></button>
                <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="Ro‘yxat" aria-label="Ro‘yxat"><Icon n="view_agenda" size={20} /></button>
              </div>
            </div>
          </div>

          {map && <div className="st-map-mobile only-mobile">{r.data && <MapView pins={pins} onPin={(id) => router.push(`/stadiums/${id}`)} />}</div>}

          {r.error && !r.data ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data ? (
            <div className="st-cards">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card" style={{ overflow: 'hidden' }}><Skeleton h={220} r={0} /><div className="col" style={{ padding: 18, gap: 10 }}><Skeleton h={18} w="60%" /><Skeleton h={14} w="40%" /><Skeleton h={44} /></div></div>)}</div>
          ) : !items.length ? (
            <div className="col" style={{ padding: '56px 24px', borderRadius: 20, border: '1.5px dashed var(--border-strong)', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <Icon n="stadium" size={40} style={{ color: 'var(--text-3)' }} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>Bu filtrlarga mos stadion topilmadi</div>
              <div className="c2" style={{ fontSize: 15, maxWidth: 360 }}>Maksimal narxni oshiring yoki filtrni olib tashlang. Ko‘p maydonlar 21:00 dan keyin bo‘shaydi.</div>
              <button className="btn btn-inverse" onClick={clear}>Filtrlarni tozalash</button>
            </div>
          ) : (
            <div className={`st-cards ${view === 'list' ? 'list' : ''}`} style={{ opacity: r.loading ? 0.6 : 1, transition: 'opacity .2s' }}>
              {items.map((s) => {
                const avail = s.freeSlots > 3 ? ['var(--success)', `${s.freeSlots} ta bo‘sh soat`] : s.freeSlots ? ['var(--warning)', `${s.freeSlots} ta soat qoldi`] : ['var(--error)', 'Bugun band'];
                const tags = [...s.sizes.map((x) => SIZE_LABEL[x]), ...s.surfaces.slice(0, 1).map((x) => SURFACE_LABEL[x]), s.indoor.includes(true) ? (s.indoor.includes(false) ? 'Yopiq/ochiq' : 'Yopiq') : 'Ochiq'];
                return (
                  <div key={s.id} className={`card st-card ${view === 'list' ? 'list' : ''}`} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} style={{ boxShadow: hover === s.id ? 'inset 0 0 0 2px var(--brand-ink)' : undefined }}>
                    <Link href={`/stadiums/${s.id}?date=${date}&time=${time}`} className="st-photo ph" style={{ background: s.photo ? `center/cover url("${s.photo}")` : undefined }}>
                      <span className="mono" style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--surface)', color: avail[0], fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' }}><span className="dot" />{avail[1]}</span>
                    </Link>
                    <div className="col" style={{ padding: '16px 18px 18px', gap: 10, minWidth: 0 }}>
                      <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                        <Link href={`/stadiums/${s.id}?date=${date}&time=${time}`} style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text-1)' }}>{s.name}</Link>
                        {s.rating != null && <div className="row mono" style={{ gap: 3, fontSize: 14, fontWeight: 500, flexShrink: 0 }}><Icon n="star" fill size={16} style={{ color: 'var(--brand-ink)' }} />{dec(s.rating)}<span className="c3">({s.reviews})</span></div>}
                      </div>
                      <div className="c2" style={{ fontSize: 14 }}>{s.district} · {dec(s.distanceKm)} km</div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {tags.map((t) => <span key={t} className="tag">{t}</span>)}
                        <span className="row c2" style={{ gap: 6, marginLeft: 4 }}>{s.amenities.slice(0, 3).map((a) => AMENITY[a] && <span key={a} title={AMENITY[a][1]}><Icon n={AMENITY[a][0]} size={18} /></span>)}</span>
                      </div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {s.times.map((t) => <Link key={t.time} href={t.free ? `/stadiums/${s.id}?date=${date}&time=${t.time}` : '#'} className="mono" style={{ height: 28, padding: '0 10px', display: 'inline-flex', alignItems: 'center', borderRadius: 8, background: 'var(--bg)', fontSize: 12, fontWeight: 500, color: t.free ? 'var(--text-1)' : 'var(--text-3)', textDecoration: t.free ? 'none' : 'line-through', pointerEvents: t.free ? 'auto' : 'none' }} aria-label={`${t.time} ${t.free ? 'bo‘sh' : 'band'}`}>{t.time}</Link>)}
                      </div>
                      <div className="row between" style={{ paddingTop: 6, marginTop: 'auto', gap: 8 }}>
                        <div><span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{sum(s.price)}</span><span className="c2" style={{ fontSize: 14 }}> /soat</span></div>
                        <Link href={`/stadiums/${s.id}?date=${date}&time=${time}`} className="btn btn-primary">Bron qilish</Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
        {map && (
          <aside className="st-map hide-mobile">
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
              <MapView pins={pins} me={null} onPin={(id) => router.push(`/stadiums/${id}`)} onHover={setHover} onMove={setCenter} />
              {center && <button className="btn btn-surface btn-sm" style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)', zIndex: 500, boxShadow: '0 6px 16px -4px rgba(0,0,0,.4)' }} onClick={() => { setArea(center); setDistrict(''); }}><Icon n="refresh" size={18} />Shu hududda qidirish</button>}
              <div className="row" style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 500, gap: 12, padding: '8px 12px', borderRadius: 12, background: 'var(--surface)', fontSize: 12, color: 'var(--text-2)' }}>
                {([['var(--success)', 'Bo‘sh'], ['var(--warning)', 'Kam qoldi'], ['var(--error)', 'Band']] as const).map(([c, l]) => <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</span>)}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function StadiumsPage() {
  return <Suspense><StadiumsInner /></Suspense>;
}
