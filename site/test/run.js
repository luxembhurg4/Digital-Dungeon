const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8765/';
const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' [' + extra + ']' : ''));
}
async function getSave(page) {
  return JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1')));
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('compute-pressure') === -1) errors.push('console: ' + m.text()); });

  // 1. initial load -> Gate room
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 15000 });
  check('Gate visible on load', await page.isVisible('#room-gate'));
  let s = await getSave(page);
  check('starts at 1/8 explored', s.explored.length === 1 && s.explored[0] === 0);
  await page.screenshot({ path: 'shots/01-gate.png', fullPage: true });

  // 2. Enter the dungeon -> hallway 1 at spawn
  await page.click('.gate-hero [data-act="continue"]');
  await page.waitForSelector('#screen-hallway', { state: 'visible' });
  s = await getSave(page);
  check('hallway 1 entered at spawn (176,224)',
    s.hall && s.hall.i === 0 && s.hall.x === 176 && s.hall.y === 224,
    JSON.stringify(s.hall));
  await page.screenshot({ path: 'shots/02-hallway1.png', fullPage: true });

  // 3. walk up into the gold threshold -> Profile Hall opens
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3800);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400);
  check('Profile Hall opened via doorway', await page.isVisible('#room-profile-hall'));
  s = await getSave(page);
  check('explored is 2/8', s.explored.length === 2, JSON.stringify(s.explored));
  await page.screenshot({ path: 'shots/03-profile.png', fullPage: true });

  // 4. Continue -> hallway 2 at its spawn
  await page.click('#room-profile-hall [data-act="continue"]');
  await page.waitForSelector('#screen-hallway', { state: 'visible' });
  s = await getSave(page);
  check('hallway 2 at spawn (80,208)',
    s.hall && s.hall.i === 1 && s.hall.x === 80 && s.hall.y === 208,
    JSON.stringify(s.hall));
  check('crumb shows Hallway 02', (await page.textContent('#crumb-room')) === 'Hallway 02');
  await page.screenshot({ path: 'shots/04-hallway2.png', fullPage: true });

  // 5. wall blocks movement
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(200);
  s = await getSave(page);
  check('left wall stops knight at x=44', s.hall.x === 44, 'x=' + s.hall.x);

  // 6. D-pad press-and-hold moves the knight
  const before = s.hall.y;
  await page.locator('.dpad-btn[data-dir="up"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(700);
  await page.locator('.dpad-btn[data-dir="up"]').dispatchEvent('pointerup');
  await page.waitForTimeout(300);
  s = await getSave(page);
  check('D-pad hold moves knight up', s.hall.y < before, 'y ' + before + ' -> ' + s.hall.y);

  // 7. chapter navigation rules
  await page.click('#chapter-list button[data-i="0"]');
  await page.waitForSelector('#room-gate', { state: 'visible' });
  check('chapter jump to Gate works', await page.isVisible('#room-gate'));
  check('locked chapter is disabled',
    await page.locator('#chapter-list button[data-i="3"]').isDisabled());

  // 8. Return-to-hallway placement below destination threshold
  await page.click('.gate-hero [data-act="continue"]');
  await page.waitForSelector('#screen-hallway', { state: 'visible' });
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3800);
  await page.keyboard.up('ArrowUp');
  await page.waitForSelector('#room-profile-hall', { state: 'visible' });
  await page.click('#room-profile-hall [data-act="return"]');
  await page.waitForSelector('#screen-hallway', { state: 'visible' });
  s = await getSave(page);
  check('return places knight below threshold (176,48)',
    s.hall.x === 176 && s.hall.y === 48, JSON.stringify(s.hall));

  // 9. re-arm loop guard
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(200);
  check('room did not reopen while leaving', await page.isVisible('#screen-hallway'));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(300);
  check('walking back up re-opens Profile Hall', await page.isVisible('#room-profile-hall'));

  // 10. restore full progress -> Exit
  await page.addInitScript(() => {
    localStorage.setItem('dungeon-of-tabs-save-v1', JSON.stringify({
      v: 1, explored: [0,1,2,3,4,5,6,7],
      wellness: [true,true,false,false,false,false,false],
      reel: 6, current: { type: 'room', i: 7 }, hall: null
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 15000 });
  check('Exit restored from save', await page.isVisible('#room-exit'));
  const cleared = await page.textContent('#cleared-text');
  check('cleared text shows wellness 2/7', cleared.indexOf('2 of 7') !== -1, cleared);
  await page.screenshot({ path: 'shots/05-exit.png', fullPage: true });

  // 11. Reel Trap simulation
  await page.click('#chapter-list button[data-i="4"]');
  await page.waitForSelector('#room-reel-trap', { state: 'visible' });
  check('reel time 10:42 PM at 6 swipes',
    (await page.textContent('#reel-time')) === '10:42 PM' &&
    (await page.textContent('#reel-count')) === '6');
  check('lost-time message shown', await page.isVisible('#reel-lost'));
  await page.click('#reel-escape');
  check('escape resets to 9:00 PM',
    (await page.textContent('#reel-time')) === '9:00 PM' &&
    (await page.textContent('#reel-count')) === '0');
  await page.click('#reel-swipe');
  check('swipe adds 17 min', (await page.textContent('#reel-time')) === '9:17 PM');
  await page.screenshot({ path: 'shots/06-reel.png', fullPage: true });

  // 12. Plan Armory wellness toggle
  await page.click('#chapter-list button[data-i="5"]');
  await page.waitForSelector('#room-plan-armory', { state: 'visible' });
  check('wellness restored 2 of 7', (await page.textContent('#wellness-count')) === '2 of 7');
  await page.check('.quest-check[data-i="2"]');
  check('checking quest -> 3 of 7', (await page.textContent('#wellness-count')) === '3 of 7');
  s = await getSave(page);
  check('wellness saved', s.wellness.filter(Boolean).length === 3);
  await page.screenshot({ path: 'shots/07-plan.png', fullPage: true });

  // 13. Analysis accordions
  await page.click('#chapter-list button[data-i="2"]');
  await page.waitForSelector('#room-analysis-chamber', { state: 'visible' });
  await page.click('#room-analysis-chamber .qa:first-of-type summary');
  check('qa counter counts open chests',
    (await page.textContent('#qa-counter')).indexOf('1 / 10') === 0);
  await page.screenshot({ path: 'shots/08-analysis.png', fullPage: true });

  // 14. Reset progress
  page.once('dialog', d => d.accept());
  await page.click('#reset-btn');
  await page.waitForTimeout(500);
  s = await getSave(page);
  check('reset returns to Gate with 1/8', s.explored.length === 1 && s.wellness.every(w => !w));

  check('no runtime errors', errors.length === 0, errors.join(' | '));

  console.log(results.join('\n'));
  await browser.close();
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.error('TEST CRASHED:', e); process.exit(2); });

