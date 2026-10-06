const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden' });
  await page.click('.gate-hero [data-act="continue"]');
  await page.waitForSelector('#screen-hallway', { state: 'visible' });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const c = document.getElementById('hallway-canvas');
    const f = document.getElementById('hallway-canvas-frame');
    const cr = c.getBoundingClientRect(), fr = f.getBoundingClientRect();
    return {
      attrW: c.width, attrH: c.height, styleW: c.style.width, styleH: c.style.height,
      cssW: cr.width, cssH: cr.height, cssLeft: cr.left,
      frameW: fr.width, frameLeft: fr.left,
      frameStyle: getComputedStyle(f).display
    };
  });
  console.log('canvas:', JSON.stringify(m, null, 1));
  // dpad svg closeup
  await page.locator('.dpad').screenshot({ path: 'shots/dpad.png' });
  const svg = await page.evaluate(() => {
    const s = document.querySelector('.dpad-up svg');
    return { html: s.outerHTML, fill: getComputedStyle(s.querySelector('path')).fill, rect: s.getBoundingClientRect().toJSON() };
  });
  console.log('svg:', JSON.stringify(svg));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
