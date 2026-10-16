// API mijoz: barcha so‘rovlar /api/v1 orqali (Next.js rewrite → API server), cookie bilan.
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

export async function api<T = unknown>(path: string, o: Opts = {}): Promise<T> {
  const init: RequestInit = { method: o.method ?? (o.body || o.form ? 'POST' : 'GET'), credentials: 'include', signal: o.signal, headers: {} };
  if (o.form) init.body = o.form;
  else if (o.body !== undefined) {
    init.body = JSON.stringify(o.body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Internetga ulanib bo‘lmadi. Aloqani tekshiring.', 'network');
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { error: text }; } })() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Xatolik yuz berdi', data?.code);
  return data as T;
}

export const get = <T,>(p: string, signal?: AbortSignal) => api<T>(p, { signal });
export const post = <T,>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: body ?? {} });
export const put = <T,>(p: string, body?: unknown) => api<T>(p, { method: 'PUT', body });
export const patch = <T,>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body });
export const del = <T,>(p: string) => api<T>(p, { method: 'DELETE' });
export const upload = <T,>(p: string, form: FormData, method = 'POST') => api<T>(p, { method, form });

export const qs = (o: Record<string, string | number | boolean | undefined | null | string[]>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    s.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : '';
};
