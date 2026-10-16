'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { get, post } from './api';

export type Me = {
  id: string; name: string; username: string | null; role: 'player' | 'owner' | 'admin'; position: string | null; foot: string | null;
  district: string | null; level: number; xp: number; skill: string | null; bio: string | null; jersey: number | null; available: string[];
  avatarUrl: string | null; coverUrl: string | null; verified: boolean; status: string;
};
type Handler = (data: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
type Ctx = {
  me: Me | null; loading: boolean; staff: boolean; home: string; unread: number; unreadChats: number;
  refresh: () => Promise<void>; logout: () => Promise<void>; on: (type: string, fn: Handler) => () => void; send: (m: object) => boolean;
  setUnread: (n: number) => void; setUnreadChats: (fn: (n: number) => number) => void; connected: boolean;
};
const SessionCtx = createContext<Ctx | null>(null);

function wsUrl() {
  const env = process.env.NEXT_PUBLIC_WS_URL;
  if (env) return env;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [staff, setStaff] = useState(false);
  const [home, setHome] = useState('/home');
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [connected, setConnected] = useState(false);
  const handlers = useRef(new Map<string, Set<Handler>>());
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const r = await get<{ user: Me; staff: boolean; home: string; unread: number; unreadChats: number }>('/auth/me');
      setMe(r.user); setStaff(r.staff); setHome(r.home); setUnread(r.unread); setUnreadChats(r.unreadChats);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Real vaqt: WebSocket (uzilsa – qayta ulanadi)
  useEffect(() => {
    if (!me) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = async () => {
      try {
        const { token } = await get<{ token: string }>('/auth/ws-token');
        if (stop) return;
        const s = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);
        ws.current = s;
        s.onopen = () => { retry.current = 0; setConnected(true); };
        s.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data) as { type: string; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (m.type === 'notification' && typeof m.data?.unread === 'number') setUnread(m.data.unread);
            if (m.type === 'message' && m.data?.sender?.id !== me.id) setUnreadChats((n) => n + (handlers.current.get('message:active')?.size ? 0 : 1));
            handlers.current.get(m.type)?.forEach((fn) => fn(m.data));
          } catch { /* noop */ }
        };
        s.onclose = () => {
          setConnected(false);
          if (stop) return;
          timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry.current++));
        };
      } catch {
        if (!stop) timer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => { stop = true; clearTimeout(timer); ws.current?.close(); };
  }, [me?.id]);

  const on = useCallback((type: string, fn: Handler) => {
    const set = handlers.current.get(type) ?? new Set();
    set.add(fn);
    handlers.current.set(type, set);
    return () => { set.delete(fn); };
  }, []);
  const send = useCallback((m: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) { ws.current.send(JSON.stringify(m)); return true; }
    return false;
  }, []);
  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    setMe(null);
    location.href = '/';
  }, []);

  return (
    <SessionCtx.Provider value={{ me, loading, staff, home, unread, unreadChats, refresh, logout, on, send, setUnread, setUnreadChats, connected }}>
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('SessionProvider yo‘q');
  return c;
}

/** WS hodisasiga obuna */
export function useEvent(type: string, fn: Handler) {
  const { on } = useSession();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => on(type, (d) => ref.current(d)), [on, type]);
}
