'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, get } from './api';

/** Ma’lumot yuklash: loading / error / data / reload. path=null – so‘ramaydi. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const ctrl = useRef<AbortController | null>(null);
  const load = useCallback(async (silent = false) => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await get<T>(path, c.signal);
      if (!c.signal.aborted) setData(d);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof ApiError ? e : new ApiError(0, 'Xatolik yuz berdi'));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load, ...deps]);
  return { data, error, loading, reload: () => load(true), setData };
}
