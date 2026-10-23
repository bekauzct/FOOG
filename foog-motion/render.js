// Ishlatish: node render.js beats|full|audio  (Playwright, 60fps × 3 subkadr)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const mode = process.argv[2] || 'beats';
const OUT = path.join(__dirname, 'build');
(async () => {
  fs.mkdirSync(OUT + '/frames', { recursive: true }); fs.mkdirSync(OUT + '/beats', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('file://' + path.join(__dirname, 'reel.html'));
  await p.evaluate(() => window.ready);
  const shot = async (t, file) => {
    await p.evaluate((t) => new Promise((r) => { window.seek(t); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
    await p.screenshot({ path: file, type: 'jpeg', quality: 93 });
  };
  if (mode === 'audio') {
    const b64 = await p.evaluate(() => window.renderAudio());
    fs.writeFileSync(OUT + '/audio.wav', Buffer.from(b64, 'base64'));
  } else if (mode === 'beats') {
    const ts = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
    const list = ts.length ? ts : Array.from({ length: 30 }, (_, i) => i * 0.5 + 0.3);
    for (const t of list) await shot(t, `${OUT}/beats/b${t.toFixed(2)}.jpg`);
  } else {
    // 15 s × 60 fps × 3 subkadr = 2700 kadr (180 fps), keyin tmix bilan aralashtiriladi
    const total = 15 * 180, from = Number(process.argv[3] || 0);
    for (let i = from; i < total; i++) {
      await shot(i / 180, `${OUT}/frames/f${String(i).padStart(5, '0')}.jpg`);
      if (i % 180 === 0) console.log('frame', i, '/', total);
    }
  }
  await b.close();
})();
