'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Async, Avatar, Btn, Empty, Icon, Modal } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { patch, post } from '@/lib/api';
import { useEvent, useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { addDays, agoShort, isoDate, todayStr, mondayOf } from '@/lib/format';

type N = {
  id: string; type: string; kind: string; title: string; body: string | null; refType: string | null; refId: string | null; data: Record<string, string> | null; read: boolean; createdAt: string;
  actor: { id: string; name: string; username: string | null; avatarUrl: string | null } | null; followingActor: boolean; invite: string | null; thumb: string | null;
};
type R = { unread: number; counts: Record<string, number>; items: N[] };

const BADGE: Record<string, [string, string, string]> = {
  match_invite: ['sports_soccer', 'var(--primary)', 'var(--on-primary)'], booking_confirmed: ['event_available', 'var(--success)', '#fff'], booking_request: ['event_note', 'var(--warning)', '#fff'],
  booking_rejected: ['event_busy', 'var(--error)', '#fff'], booking_expired: ['timer_off', 'var(--text-3)', '#fff'], booking_cancelled: ['event_busy', 'var(--error)', '#fff'], booking_no_show: ['person_off', 'var(--error)', '#fff'],
  follow: ['person_add', 'var(--accent)', '#fff'], like: ['favorite', 'var(--error)', '#fff'], comment: ['chat_bubble', 'var(--accent)', '#fff'], match_result: ['star', 'var(--primary)', 'var(--on-primary)'],
  match_join: ['group_add', 'var(--success)', '#fff'], achievement: ['emoji_events', 'var(--primary)', 'var(--on-primary)'], slot_alert: ['bolt', 'var(--warning)', '#fff'], review: ['star', 'var(--warning)', '#fff'],
  review_reply: ['reply', 'var(--accent)', '#fff'], reel_published: ['smart_display', 'var(--success)', '#fff'], reel_failed: ['error', 'var(--error)', '#fff'], stadium_approved: ['verified', 'var(--success)', '#fff'],
  stadium_rejected: ['report', 'var(--error)', '#fff'], stadium_application: ['stadium', 'var(--warning)', '#fff'], warning: ['gpp_maybe', 'var(--warning)', '#fff'], dispute_resolved: ['gavel', 'var(--accent)', '#fff'], team_join: ['groups', 'var(--success)', '#fff'], team_captain: ['military_tech', 'var(--primary)', 'var(--on-primary)'], team_removed: ['person_remove', 'var(--error)', '#fff'], team_deleted: ['group_off', 'var(--text-3)', '#fff'], match_removed: ['person_remove', 'var(--error)', '#fff'], match_cancelled: ['event_busy', 'var(--error)', '#fff'], staff_added: ['badge', 'var(--accent)', '#fff'],
};
const ICON_TILE: Record<string, string> = { booking: 'stadium', match: 'scoreboard', system: 'notifications', social: 'favorite', invite: 'sports_soccer' };

function Item({ n, onRead }: { n: N; onRead: (id: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<string | null>(n.invite);
  const [fol, setFol] = useState(n.followingActor);
  const [busy, setBusy] = useState<string | null>(null);
  const { me } = useSession();
  const owner = me?.role === 'owner';
  const href = n.refType === 'booking' ? (owner ? '/owner/bookings' : '/bookings') : n.refType === 'match' ? `/matches/${n.refId}` : n.refType === 'reel' ? `/reels?start=${n.refId}` : n.refType === 'user' && n.actor ? `/u/${n.actor.username}` : n.refType === 'stadium' ? (owner ? '/owner/stadiums' : me?.role === 'admin' ? '/admin/stadiums' : `/stadiums/${n.refId}`) : n.refType === 'post' ? '/home' : n.refType === 'team' ? '/discover?tab=teams' : n.refType === 'review' ? '/owner/reviews' : null;
  const open = () => { if (!n.read) onRead(n.id); if (href) router.push(href); };
  const act = async (k: 'accept' | 'decline') => {
    setBusy(k);
    try {
      const r = await post<{ status: string; chatId?: string }>(`/invites/${n.refId}/${k}`);
      setState(r.status); onRead(n.id);
      toast(k === 'accept' ? 'Siz o‘yindasiz! O‘yin chatiga qo‘shildingiz.' : 'Taklif rad etildi', { action: r.chatId ? { label: 'Chatni ochish', fn: () => router.push(`/messages/${r.chatId}`) } : undefined });
    } catch (e) { toast((e as Error).message, { kind: 'warn' }); } finally { setBusy(null); }
  };
  const followBack = async () => {
    if (!n.actor?.username) return;
    setBusy('f');
    try { const r = await post<{ following: boolean }>(`/users/${n.actor.username}/follow`); setFol(r.following); onRead(n.id); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  const [ic, bg, fg] = BADGE[n.kind] ?? ['notifications', 'var(--surface-2)', 'var(--text-1)'];
  const meta = [agoShort(n.createdAt), n.body].filter(Boolean).join(' · ');
  return (
    <div className="nt-item" style={{ background: n.read ? 'transparent' : 'var(--surface)' }} onClick={open} role={href ? 'link' : undefined} tabIndex={href ? 0 : undefined} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {n.actor ? <Avatar name={n.actor.name} url={n.actor.avatarUrl} size={48} /> : <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-ink)' }}><Icon n={ICON_TILE[n.type] ?? 'notifications'} fill /></span>}
        <span style={{ position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--bg)' }}><Icon n={ic} fill size={14} /></span>
      </div>
      <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 600 }}>{n.title}</div>
        <div className="mono c2" style={{ fontSize: 12, lineHeight: 1.5 }}>{meta}</div>
        <div className="row wrap" style={{ gap: 8, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
          {n.kind === 'match_invite' && n.refType === 'invite' && (state === 'pending' || !state ? (
            <><Btn className="btn btn-primary btn-sm" loading={busy === 'accept'} onClick={() => act('accept')}>Qabul qilish</Btn><Btn className="btn btn-outline btn-sm" loading={busy === 'decline'} onClick={() => act('decline')}>Rad etish</Btn></>
          ) : <span className="pill-tag muted">{state === 'accepted' ? 'Qabul qilindi ✓' : 'Rad etildi'}</span>)}
          {n.kind === 'booking_confirmed' && !owner && <><Link href="/bookings" className="btn btn-primary btn-sm">Bronni ko‘rish</Link></>}
          {n.kind === 'booking_request' && owner && <Link href="/owner/bookings" className="btn btn-primary btn-sm">Ko‘rib chiqish</Link>}
          {(n.kind === 'booking_rejected' || n.kind === 'booking_expired') && <Link href="/stadiums" className="btn btn-outline btn-sm">Boshqa soat tanlash</Link>}
          {n.kind === 'booking_no_show' && <Link href="/bookings" className="btn btn-outline btn-sm">E’tiroz bildirish</Link>}
          {n.kind === 'follow' && n.actor && <Btn className={`btn btn-sm ${fol ? 'btn-outline' : 'btn-inverse'}`} loading={busy === 'f'} onClick={followBack}>{fol ? 'Kuzatilmoqda' : 'Javoban kuzatish'}</Btn>}
          {n.kind === 'match_result' && n.refId && <Link href={`/matches/${n.refId}`} className="btn btn-outline btn-sm">O‘yinni ko‘rish</Link>}
          {n.kind === 'slot_alert' && n.refId && <Link href={`/stadiums/${n.refId}`} className="btn btn-primary btn-sm">Bron qilish</Link>}
          {n.kind === 'reel_failed' && <Link href="/reels?upload=1" className="btn btn-outline btn-sm">Qayta yuklash</Link>}
          {n.kind === 'stadium_rejected' && <Link href="/owner/stadiums" className="btn btn-outline btn-sm">Tuzatish</Link>}
        </div>
      </div>
      {n.thumb && <span className="ph" style={{ width: 56, height: 56, borderRadius: 10, flexShrink: 0, background: `center/cover url("${n.thumb}")` }} />}
      {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} aria-label="O‘qilmagan" />}
    </div>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState('all');
  const q = useApi<R>(`/notifications?tab=${tab}`);
  const { setUnread } = useSession();
  const [settings, setSettings] = useState(false);
  const toast = useToast();
  useEvent('notification', () => q.reload());
  const markRead = async (ids: string[] | 'all') => {
    try {
      const r = await patch<{ unread: number }>('/notifications/read', ids === 'all' ? { all: true } : { ids });
      setUnread(r.unread);
      q.setData(q.data ? { ...q.data, unread: r.unread, items: q.data.items.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, read: true } : n)) } : null);
      if (ids === 'all') toast('Hammasi o‘qildi');
    } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const d = q.data;
  const today = todayStr();
  const mon = mondayOf(today);
  const groups: [string, N[]][] = d ? [
    ['Bugun', d.items.filter((n) => isoDate(n.createdAt) === today)],
    ['Shu hafta', d.items.filter((n) => isoDate(n.createdAt) < today && isoDate(n.createdAt) >= (mon === today ? addDays(today, -6) : mon))],
    ['Oldinroq', d.items.filter((n) => isoDate(n.createdAt) < (mon === today ? addDays(today, -6) : mon))],
  ] : [];
  const c = d?.counts ?? {};
  return (
    <div className="page-narrow col" data-tour="list" style={{ gap: 20, maxWidth: 808 }}>
      <div className="row between wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
        <div className="col" style={{ gap: 4 }}>
          <h1 className="t-page" style={{ fontSize: 34, lineHeight: '40px' }}>Bildirishnomalar</h1>
          <span className="c2" style={{ fontSize: 15 }}>{d ? (d.unread ? `Oxirgi tekshiruvdan beri ${d.unread} ta yangi` : 'Hammasi o‘qilgan') : ' '}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => markRead('all')} disabled={!d?.unread}><Icon n="done_all" size={18} />Hammasini o‘qildi deb belgilash</button>
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Sozlamalar"><Icon n="settings" size={22} /></button>
        </div>
      </div>
      <div className="row scroll-x" style={{ gap: 8 }}>
        {([['all', 'Hammasi'], ['invite', 'Takliflar'], ['match', 'O‘yinlar'], ['booking', 'Bronlar'], ['social', 'Ijtimoiy'], ['unread', 'O‘qilmagan']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}{!!c[k] && tab !== k && <span className="count">{c[k]}</span>}</button>
        ))}
      </div>
      <Async q={q} empty={(x) => !x.items.length && <div className="card"><Empty icon="notifications_off" title={tab === 'unread' ? 'O‘qilmagan bildirishnoma yo‘q' : 'Hozircha bildirishnoma yo‘q'} text="Takliflar, bron javoblari va yangi kuzatuvchilar shu yerda chiqadi." /></div>}>
        {() => (
          <div className="col" style={{ gap: 24 }}>
            {groups.filter(([, l]) => l.length).map(([g, list]) => (
              <section key={g} className="col" style={{ gap: 6 }}>
                <div className="label-sm c2" style={{ padding: '0 4px 4px' }}>{g}</div>
                {list.map((n) => <Item key={n.id} n={n} onRead={(id) => markRead([id])} />)}
              </section>
            ))}
          </div>
        )}
      </Async>
      <Modal open={settings} onClose={() => setSettings(false)} title="Bildirishnoma sozlamalari">
        <div className="col" style={{ gap: 12, fontSize: 15 }}>
          <div className="row between"><span>Saytda bildirishnomalar</span><span className="pill-tag success">Yoqilgan</span></div>
          <div className="row between"><span>Telegram: bron javoblari va eslatmalar</span><span className="pill-tag success">Yoqilgan</span></div>
          <p className="c2 t-small">Telegram xabarlari kirishda ulashgan botingiz orqali keladi. O‘chirish uchun Telegramda botni bloklang. Alohida chatlarni ovozsiz qilish – chat ma’lumotlari panelida.</p>
        </div>
      </Modal>
    </div>
  );
}
