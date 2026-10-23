// FOOGI matn moslashtirgichi: tashqi API’siz, admin kiritgan bilimlar bo‘yicha javob topadi.
// Usul: normallashtirish (lotin/kirill, apostroflar) → o‘zbekcha qo‘shimchalarni kesish →
// IDF og‘irlikli moslik + harf uchliklari (imlo xatolariga chidamli).
import type { FoogiAnswer, FoogiAudience } from '@prisma/client';
import { prisma } from '../db';

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};
const STOP = new Set(['va', 'bilan', 'men', 'meni', 'menga', 'siz', 'sizga', 'u', 'bu', 'shu', 'uchun', 'ham', 'yoki', 'qanday', 'qanaqa', 'nima', 'nimaga', 'nega', 'qayerda', 'qachon', 'qilib', 'kerak', 'bormi', 'bor', 'yoq', 'mumkin', 'mumkinmi', 'iltimos', 'ayting', 'aytib', 'bering', 'ber', 'qilsam', 'bolsa', 'boladi', 'boladimi', 'edi', 'emas', 'da', 'ga', 'ni', 'mi', 'chi', 'a', 'the', 'is', 'how', 'what', 'i', 'my', 'kak', 'chto', 'gde', 'ya', 'mne']);
// uzundan qisqaga – birinchi mos kelgani kesiladi (ildiz kamida 3 harf qoladi)
const SUFFIX = ['larimizni', 'laringizni', 'larining', 'larimiz', 'laringiz', 'laridan', 'larida', 'lariga', 'larini', 'lardan', 'larda', 'larga', 'larni', 'larning', 'lari', 'lar', 'imizni', 'ingizni', 'imiz', 'ingiz', 'yapman', 'yapsiz', 'yapti', 'moqchiman', 'moqchi', 'ishni', 'ishga', 'ish', 'moq', 'ning', 'dagi', 'dan', 'ga', 'ka', 'qa', 'da', 'ni', 'mi', 'chi', 'man', 'miz', 'siz', 'dir', 'ingni', 'im', 'ing', 'si', 'ni'];

export function normalize(s: string) {
  return s.toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c)
    .replace(/[‘’ʻʼ`´']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function stem(w: string) {
  for (let k = 0; k < 2; k++) {
    const suf = SUFFIX.find((x) => w.endsWith(x) && w.length - x.length >= 3);
    if (!suf) break;
    w = w.slice(0, -suf.length);
  }
  return w;
}
export const tokens = (s: string) => normalize(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

const tri = (w: string) => { const p = `_${w}_`, out = new Set<string>(); for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3)); return out; };
function sim(a: string, b: string) {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  if (Math.min(a.length, b.length) < 4) return 0;
  const A = tri(a), B = tri(b);
  let n = 0; A.forEach((x) => { if (B.has(x)) n++; });
  const j = n / (A.size + B.size - n);
  return j >= 0.45 ? j : 0;
}

type Doc = { a: FoogiAnswer; terms: Map<string, number>; phrases: Set<string> };
let cache: { at: number; docs: Doc[]; idf: Map<string, number> } | null = null;
export const bust = () => { cache = null; };

async function index() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const rows = await prisma.foogiAnswer.findMany({ where: { active: true } });
  const docs: Doc[] = rows.map((a) => {
    const terms = new Map<string, number>();
    const add = (s: string, w: number) => tokens(s).forEach((t) => terms.set(t, Math.max(terms.get(t) ?? 0, w)));
    add(a.title, 1.2);
    a.questions.forEach((q) => add(q, 1));
    a.keywords.forEach((k) => add(k, 1.6));
    return { a, terms, phrases: new Set(a.questions.map(normalize)) };
  });
  const df = new Map<string, number>();
  docs.forEach((d) => d.terms.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const N = Math.max(1, docs.length);
  const idf = new Map<string, number>();
  df.forEach((n, t) => idf.set(t, Math.log(1 + N / n)));
  cache = { at: Date.now(), docs, idf };
  return cache;
}

export type Match = { answer: FoogiAnswer; score: number };
/** Eng mos javoblar (ball 0..1) */
export async function rank(text: string, audience: FoogiAudience, limit = 5): Promise<Match[]> {
  const { docs, idf } = await index();
  const q = [...new Set(tokens(text))];
  const norm = normalize(text);
  if (!q.length) return [];
  const maxIdf = Math.max(1, ...idf.values());
  const out: Match[] = [];
  for (const d of docs) {
    if (d.a.audience !== 'all' && d.a.audience !== audience && !(audience === 'admin')) continue;
    if (d.phrases.has(norm)) { out.push({ answer: d.a, score: 2 }); continue; }
    let got = 0, total = 0;
    for (const t of q) {
      let best = 0, bw = 0, bt = '';
      d.terms.forEach((w, term) => { const s = sim(t, term); if (s * w > best * bw || (s > 0 && !bt)) { best = s; bw = w; bt = term; } });
      const wt = idf.get(bt) ?? idf.get(t) ?? maxIdf;
      total += idf.get(t) ?? maxIdf * 0.6;
      if (best > 0) got += best * Math.min(1.6, bw) * wt;
    }
    const raw = got / Math.max(0.0001, total) / 1.15;
    if (raw > 0.05) out.push({ answer: d.a, score: raw });
  }
  // xom ball bo‘yicha saralanadi (kalit so‘z og‘irligi farqni saqlaydi), keyin 0..1 ga cheklanadi
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((m) => ({ ...m, score: Math.min(1, m.score) }));
}
export const ANSWER_AT = 0.42;
export const SUGGEST_AT = 0.22;
