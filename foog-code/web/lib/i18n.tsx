'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { RU } from './i18n-ru';

/** Tillar: o‘zbek (asosiy, lotin) va rus. Tanlov `foog_lang` cookie’da saqlanadi. */
export type Lang = 'uz' | 'ru';
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'uz', setLang: () => undefined });

export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setL] = useState<Lang>(initial);
  const setLang = (l: Lang) => {
    document.cookie = `foog_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    setL(l);
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
const warned = new Set<string>();

/** t('O‘zbekcha matn', { n: 5 }) – rus tilida lug‘atdan oladi, topilmasa o‘zbekcha qoladi */
export function useT() {
  const { lang } = useLang();
  return useCallback((s: string, v?: Record<string, string | number>) => {
    let r = s;
    if (lang === 'ru') {
      r = RU[s] ?? s;
      if (process.env.NODE_ENV !== 'production' && !(s in RU) && !warned.has(s)) { warned.add(s); console.warn('[i18n] tarjima yo‘q:', s); }
    }
    if (v) for (const k of Object.keys(v)) r = r.split(`{${k}}`).join(String(v[k]));
    return r;
  }, [lang]);
}

/** Narx: o‘zbekcha «so‘m», ruscha «сум» */
export function useSum() {
  const { lang } = useLang();
  return useCallback((s: string) => (lang === 'ru' ? s.replace('so‘m', 'сум') : s), [lang]);
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  const next = lang === 'uz' ? 'ru' : 'uz';
  return (
    <button className="icon-btn lang-btn" onClick={() => setLang(next)} aria-label={lang === 'uz' ? 'Русский язык' : 'O‘zbek tili'} title={lang === 'uz' ? 'Русский' : 'O‘zbekcha'}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>{next.toUpperCase()}</span>
    </button>
  );
}
