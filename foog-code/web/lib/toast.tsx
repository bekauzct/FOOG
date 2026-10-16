'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type T = { id: number; text: string; kind: 'ok' | 'warn' | 'err'; undo?: () => void; action?: { label: string; fn: () => void } };
type Ctx = (text: string, o?: { kind?: T['kind']; undo?: () => void; action?: T['action'] }) => void;
const ToastCtx = createContext<Ctx>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const id = useRef(0);
  const toast = useCallback<Ctx>((text, o = {}) => {
    const t: T = { id: ++id.current, text, kind: o.kind ?? 'ok', undo: o.undo, action: o.action };
    setItems((s) => [...s.slice(-2), t]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), o.undo || o.action ? 5000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span className="ms fill" style={{ color: t.kind === 'ok' ? 'var(--success)' : t.kind === 'warn' ? 'var(--warning)' : 'var(--error)' }}>
              {t.kind === 'ok' ? 'check_circle' : t.kind === 'warn' ? 'info' : 'error'}
            </span>
            <span>{t.text}</span>
            {t.undo && <button onClick={() => { t.undo!(); setItems((s) => s.filter((x) => x.id !== t.id)); }}>Bekor qilish</button>}
            {t.action && <button onClick={() => { t.action!.fn(); setItems((s) => s.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
