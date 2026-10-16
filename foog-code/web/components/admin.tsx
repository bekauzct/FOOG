'use client';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { dayMonth, todayStr } from '@/lib/format';

export function AdminHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { me } = useSession();
  return (
    <div className="row between wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
      <div className="col" style={{ gap: 4 }}>
        <div className="label">FOOG admin · Toshkent · {dayMonth(todayStr())}</div>
        <h1 className="t-page">{title}</h1>
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        {children}
        {me && <span className="row" style={{ gap: 8, height: 36, padding: '0 14px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px var(--border-strong)', fontSize: 13 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />{me.name} · Moderator</span>}
      </div>
    </div>
  );
}
