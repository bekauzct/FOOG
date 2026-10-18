// Ikonkalar: 4,6 MB Material Symbols shrifti o‘rniga faqat ishlatilgan ikonkalarning SVG yo‘llari.
// Manba kodidagi barcha 'snake_case' satrlarni yig‘adi va @material-symbols/svg-400 da borlarini oladi.
// Ishga tushirish: npm run icons  (ikonka qo‘shilganda qayta ishga tushiring)
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = join(root, 'node_modules/@material-symbols/svg-400/rounded');
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) && !f.includes('icons.generated') && files.push(p); });
['app', 'components', 'lib'].forEach((d) => walk(join(root, d)));

const names = new Set();
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/['"`]([a-z][a-z0-9_]{1,40})['"`]/g)) names.add(m[1]);
// API dan keladigan ikonka nomlari (masalan, yutuqlar)
const api = join(root, '../api/src');
const walkApi = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) return walkApi(p); if (f.endsWith('.ts')) for (const m of readFileSync(p, 'utf8').matchAll(/icon: ?'([a-z0-9_]+)'/g)) names.add(m[1]); });
if (existsSync(api)) walkApi(api);
const pathOf = (file) => { const s = readFileSync(file, 'utf8'); return [...s.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' '); };

const out = {};
for (const n of [...names].sort()) {
  const base = join(pkg, `${n}.svg`);
  if (!existsSync(base)) continue;
  const fill = join(pkg, `${n}-fill.svg`);
  const o = pathOf(base), fl = existsSync(fill) ? pathOf(fill) : o;
  out[n] = fl === o ? [o] : [o, fl];
}
writeFileSync(join(root, 'components/icons.generated.ts'), `// Avtomatik yaratilgan: scripts/gen-icons.mjs. Qo‘lda tahrirlamang.\n// [oddiy, to‘ldirilgan] SVG yo‘llari, viewBox "0 -960 960 960"\nexport const ICONS: Record<string, [string] | [string, string]> = ${JSON.stringify(out)};\n`);
console.log(`icons: ${Object.keys(out).length}`);
