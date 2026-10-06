const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => console.log('CONSOLE[' + m.type() + ']:', m.text()));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden' });
  // jump straight to hallway 2 via injected save (init script survives reload)
  await page.addInitScript(() => localStorage.setItem('dungeon-of-tabs-save-v1', JSON.stringify({
    v: 1, explored: [0, 1], wellness: [false,false,false,false,false,false,false], reel: 0,
    current: { type: 'hallway' }, hall: { i: 1, x: 80, y: 208, dir: 'down' }
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden' });
  // measure rAF rate
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    function tick() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); }
    requestAnimationFrame(tick);
  }));
  console.log('rAF fps:', fps);
  const get = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1'))).hall;
  console.log('start:', JSON.stringify(await get()));
  await page.keyboard.down('ArrowLeft');
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250);
    const live = await page.evaluate(() => Hallway.debug());
    const stored = await get();
    console.log('t=' + (250 * (i + 1)) + ' live.x=' + live.x.toFixed(2) +
      ' held=' + JSON.stringify(live.held) + ' moving=' + live.moving +
      ' stored.x=' + stored.x);
  }
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(300);
  console.log('final:', JSON.stringify(await get()));
  console.log('debug:', JSON.stringify(await page.evaluate(() => Hallway.debug())));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
