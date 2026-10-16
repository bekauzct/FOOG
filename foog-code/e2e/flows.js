const { chromium } = require('playwright');
const W = 'http://localhost:3000';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const shots = (process.env.SHOTS ?? '/tmp') + '/e2e-';
async function ctx(b, width = 1440) {
  const c = await b.newContext({ viewport: { width, height: 900 } });
  await c.route(/^https:\/\//, (r) => r.abort());
  c.on('page', (p) => { p.on('pageerror', (e) => log('PAGEERR', e.message)); });
  return c;
}
async function uiLogin(c, phone, expectPath, opts = {}) {
  const p = await c.newPage();
  await p.goto(W + '/login');
  const [popup] = await Promise.all([c.waitForEvent('page', { timeout: 5000 }).catch(() => null), p.getByRole('button', { name: 'Telegram orqali kirish' }).click()]);
  if (popup) await popup.close();
  await p.getByLabel('Telefon raqam').fill(phone);
  await p.getByRole('button', { name: 'Ulashish' }).click();
  if (opts.newUser) {
    await p.getByText('Xush kelibsiz!').waitFor({ timeout: 15000 });
    await p.getByText(opts.newUser.role === 'owner' ? 'Stadion egasiman' : 'Futbolchiman').click();
    await p.getByPlaceholder('Ism Familiya').fill(opts.newUser.name);
    await p.getByRole('button', { name: 'Davom etish' }).click();
  }
  await p.waitForURL((u) => u.pathname.startsWith(expectPath), { timeout: 20000 });
  log('LOGIN OK', phone, '→', new URL(p.url()).pathname);
  return p;
}
(async () => {
  const b = await chromium.launch();
  const results = [];
  const ok = (name, v, extra = '') => { results.push([name, v ? 'OK' : 'FAIL', extra]); log(v ? 'PASS' : 'FAIL', name, extra); };
  try {
    // 1) Kirish → stadion bron → egasi tasdiqlaydi
    const P = await ctx(b); const pp = await uiLogin(P, '901112233', '/home');
    ok('Kirish (futbolchi, Telegram oqimi)', true);
    const st = await (await pp.request.get(W + '/api/v1/stadiums?q=Arena')).json();
    const arena = st.items[0];
    const d = new Date(Date.now() + 5 * 3600e3 + 4 * 864e5).toISOString().slice(0, 10);
    await pp.goto(`${W}/stadiums/${arena.id}?date=${d}`);
    await pp.locator('.sd-time:not([disabled])').first().waitFor();
    const times = pp.locator('.sd-time:not([disabled])');
    await times.nth(Math.min(3, (await times.count()) - 1)).click();
    await pp.locator('.sd-pitch:not([disabled])').first().click();
    await pp.getByRole('button', { name: /^Bronni tasdiqlash ·/ }).first().click();
    await pp.locator('.modal').getByRole('button', { name: 'Bronni tasdiqlash' }).click();
    await pp.getByText('Bron so‘rovi yuborildi').waitFor({ timeout: 15000 });
    const codeText = await pp.locator('.modal').innerText();
    const code = (codeText.match(/FG-\d+/) || [])[0];
    await pp.screenshot({ path: shots + '1-booked.png' });
    ok('Bron so‘rovi yuborildi', !!code, code);
    const O = await ctx(b); const op = await uiLogin(O, '901234567', '/owner');
    await op.goto(W + '/owner/bookings?filter=pending');
    const row = op.locator('tr', { hasText: code });
    await row.waitFor({ timeout: 15000 });
    await row.getByRole('button', { name: 'Tasdiqlash' }).click();
    await op.getByText(/tasdiqlandi\. Mijozga Telegram/).waitFor({ timeout: 10000 });
    await op.screenshot({ path: shots + '2-owner-confirmed.png' });
    ok('Egasi tasdiqladi', true, code);
    await pp.goto(W + '/bookings');
    const card = pp.locator('.card', { hasText: code });
    await card.getByText('Tasdiqlangan').waitFor({ timeout: 10000 });
    ok('Futbolchida holat «Tasdiqlangan»', true);
    await pp.goto(W + '/notifications');
    ok('Bildirishnoma keldi', await pp.getByText('bronni tasdiqladi').first().isVisible());

    // 2) O‘yinga qo‘shilish
    await pp.goto(W + '/discover?tab=matches');
    const joinBtn = pp.getByRole('button', { name: /^Qo‘shilish ·/ }).first();
    await joinBtn.waitFor({ timeout: 10000 });
    await joinBtn.click();
    await pp.getByText('Siz o‘yindasiz! O‘yin chatiga qo‘shildingiz.').waitFor({ timeout: 10000 });
    await pp.screenshot({ path: shots + '3-joined.png' });
    ok('O‘yinga qo‘shilish', true);

    // 3) Reel joylash (yuklash → qayta ishlash → published, WS orqali)
    await pp.goto(W + '/reels?upload=1');
    await pp.locator('input[type=file][accept="video/*"]').setInputFiles(process.env.REEL_FILE ?? __dirname + '/test-reel.mp4');
    await pp.getByPlaceholder('Nima bo‘ldi? #heshteglar qo‘shing').fill('E2E sinov: chap oyoq bilan gol #test');
    await pp.locator('.modal').getByRole('button', { name: 'Joylash' }).click();
    await pp.getByText('Video yuklandi · qayta ishlanmoqda').waitFor({ timeout: 30000 });
    await pp.getByText('Reel joylandi · profil va lentada ko‘rinadi').waitFor({ timeout: 90000 });
    ok('Reel joylash (processing → published)', true);

    // 4) Chat: real vaqtda xabar
    const chats = await (await pp.request.get(W + '/api/v1/chats?type=dm')).json();
    const dm = chats.items.find((c) => c.name === 'Diyor Mahmudov');
    const D = await ctx(b); const dp = await uiLogin(D, '973001245', '/home');
    await dp.goto(`${W}/messages/${dm.id}`);
    await pp.goto(`${W}/messages/${dm.id}`);
    await pp.getByLabel('Xabar', { exact: true }).waitFor();
    await dp.waitForTimeout(1500);
    const msg = 'Salom! Payshanba 20:00 da o‘ynaymizmi? ' + Date.now() % 10000;
    await pp.getByLabel('Xabar', { exact: true }).type(msg.slice(0, 6));
    const typingSeen = await dp.getByText(/yozmoqda/).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    await pp.getByLabel('Xabar', { exact: true }).fill(msg);
    await pp.getByRole('button', { name: 'Yuborish' }).click();
    await dp.getByText(msg).waitFor({ timeout: 10000 });
    await dp.screenshot({ path: shots + '4-chat-received.png' });
    ok('Chat: xabar boshqa foydalanuvchiga real vaqtda keldi (WebSocket)', true);
    ok('Chat: «yozmoqda» indikatori', typingSeen);

    // 5) Admin stadionni tasdiqlaydi
    const A = await ctx(b); const ap = await uiLogin(A, '900000001', '/admin');
    await ap.goto(W + '/admin/stadiums');
    await ap.getByRole('button', { name: /Sergeli Arena/ }).click();
    const boxes = ap.locator('.ad-side button[role=checkbox][aria-checked=false]');
    for (let i = await boxes.count(); i > 0; i--) { await boxes.first().click(); await ap.waitForTimeout(200); }
    await ap.getByRole('button', { name: 'Tasdiqlash va chiqarish' }).click();
    await ap.getByText(/Sergeli Arena tasdiqlandi/).waitFor({ timeout: 10000 });
    await ap.screenshot({ path: shots + '5-admin-approved.png' });
    const pub = await (await pp.request.get(W + '/api/v1/stadiums?q=Sergeli')).json();
    ok('Admin stadionni tasdiqladi → saytda ko‘rindi', pub.items.length === 1);

    // 6) Yangi foydalanuvchi: rol tanlash
    const N = await ctx(b, 390); const np = await uiLogin(N, '93' + String(Date.now()).slice(-7), '/home', { newUser: { role: 'player', name: 'Test Futbolchi' } });
    await np.screenshot({ path: shots + '6-new-user-mobile.png', fullPage: false });
    ok('Yangi futbolchi ro‘yxatdan o‘tdi (390 px)', true);

    // 7) Rol himoyasi: futbolchi /owner ga kira olmaydi
    await pp.goto(W + '/owner');
    ok('Futbolchi /owner → /home ga yo‘naltirildi', new URL(pp.url()).pathname === '/home');
    const r403 = await pp.request.get(W + '/api/v1/admin/overview');
    ok('API: futbolchi admin API sida 403', r403.status() === 403);
  } catch (e) {
    log('ERROR', e.message);
    results.push(['XATO', 'FAIL', e.message.slice(0, 200)]);
  }
  console.log('\n=== NATIJA ===');
  for (const r of results) console.log(r.join(' | '));
  await b.close();
})();
