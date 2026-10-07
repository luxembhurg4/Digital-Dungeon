/* Smoke test — rooms engine (master plan Phase B/C). Run: node smoke-rooms.js */
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8765/';
const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra !== undefined ? ' [' + extra + ']' : ''));
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && m.text().indexOf('compute-pressure') === -1) errors.push('console: ' + m.text());
  });
  /* Wall-aware waypoint walker (same as run.js): nudges axis-by-axis at 64 px/s
     until the hero is within tol of the target; an axis that hits a wall and
     stops making progress is treated as satisfied. Blind timed holds are
     unreliable here — overshooting x to 84 puts a foot in col6, which is
     blocked at row6, stalling the climb two rows short of chest-01. */
  async function nudgeTo(tx, ty, tol) {
    tol = tol || 4;
    let xBlocked = false, yBlocked = false;
    let last = null;
    for (let k = 0; k < 10; k++) {
      const snap = await page.evaluate(() => Rooms.snapshot());
      if (!snap) return last;
      last = snap.pos;
      const dx = tx - last.x, dy = ty - last.y;
      if ((Math.abs(dx) <= tol || xBlocked) && (Math.abs(dy) <= tol || yBlocked)) return last;
      let key, ms, horiz;
      if (Math.abs(dx) > tol && !xBlocked) {
        horiz = true;
        key = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
        ms = Math.min(600, Math.abs(dx) / 64 * 1000);
      } else {
        horiz = false;
        key = dy > 0 ? 'ArrowDown' : 'ArrowUp';
        ms = Math.min(600, Math.abs(dy) / 64 * 1000);
      }
      const before = last;
      await page.keyboard.down(key);
      await page.waitForTimeout(ms);
      await page.keyboard.up(key);
      await page.waitForTimeout(70);
      const after = await page.evaluate(() => Rooms.snapshot());
      if (!after) return before;
      if (horiz && Math.abs(after.pos.x - before.x) < 0.5) xBlocked = true;
      if (!horiz && Math.abs(after.pos.y - before.y) < 0.5) yBlocked = true;
    }
    return last;
  }

  // 1. boot → Gate opens as playable map
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
  check('Gate map view visible', await page.isVisible('#room-gate .room-mapview'));
  check('Gate journal hidden in map mode', !(await page.isVisible('#room-gate .gate-hero')));
  let s = JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1')));
  check('save has rooms-engine fields', Array.isArray(s.opened) && s.view === 'map');
  const painted = await page.evaluate(() => {
    const c = document.getElementById('room-canvas');
    const d = c.getContext('2d').getImageData(0, 0, 384, 288).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  check('canvas painted (terrain + hero)', painted > 10000, painted);

  // 2. movement
  const p0 = await page.evaluate(() => Rooms.snapshot());
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowUp');
  const p1 = await page.evaluate(() => Rooms.snapshot());
  check('hero moves up', p1.pos.y < p0.pos.y - 20, p0.pos.y + ' -> ' + p1.pos.y);
  await page.screenshot({ path: 'shots/rooms-01-gate.png' });

  // 3. fast travel to Analysis Chamber (sidebar exception)
  await page.evaluate(() => App.openRoomByIndex(2, { side: 'forward' }));
  await page.waitForTimeout(400);
  check('Analysis map visible', await page.isVisible('#room-analysis-chamber .room-mapview'));
  const hud = await page.textContent('#room-analysis-chamber .rm-hud-local');
  check('HUD local progress', /Chests 0\/10/.test(hud), hud);

  // 4. navigate to chest-01 stand cell (3,5) and face up
  //    col4 is blocked at row8; waypoints: wall-stop at y=133 → col5 → row5 →
  //    col3, then tap up to face the chest (polled — see nudgeTo note above).
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1800); await page.keyboard.up('ArrowUp');
  await nudgeTo(80, 133, 2);
  await nudgeTo(80, 76, 2);
  await nudgeTo(48, 76, 2);
  await nudgeTo(48, 74, 2);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(40); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(250);
  const pos = await page.evaluate(() => Rooms.snapshot());
  const atStand = pos.pos.x >= 38 && pos.pos.x <= 56 && pos.pos.y >= 65 && pos.pos.y <= 83;
  check('stands at chest-01 interaction cell', atStand, JSON.stringify(pos.pos));
  check('"Press Space" prompt shown', await page.isVisible('#room-analysis-chamber .rm-prompt'));
  await page.screenshot({ path: 'shots/rooms-02-chest.png' });

  // 5. interact (E) → dialogue with verbatim answer
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  check('dialogue opened', await page.isVisible('#room-analysis-chamber .rm-dialog'));
  const dtitle = await page.textContent('#room-analysis-chamber .rm-dtitle');
  check('dialogue shows QA title', /content do you consume/i.test(dtitle), dtitle);

  // 6. advance through pages until closed
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    if (!(await page.isVisible('#room-analysis-chamber .rm-dialog'))) break;
  }
  check('dialogue closed after pages', !(await page.isVisible('#room-analysis-chamber .rm-dialog')));
  await page.waitForTimeout(300);
  s = JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1')));
  check('chest-01 registered as opened', s.opened.indexOf('analysis-chamber/chest-01') >= 0, JSON.stringify(s.opened));
  check('global loot is 1', s.opened.length === 1, s.opened.length);

  // 7. reopen same chest → no duplicate loot
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    if (!(await page.isVisible('#room-analysis-chamber .rm-dialog'))) break;
  }
  await page.waitForTimeout(300);
  s = JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1')));
  check('reopen grants no extra loot', s.opened.length === 1, s.opened.length);

  // 8. read mode toggle preserves state
  await page.click('#room-analysis-chamber .rm-toggle');
  await page.waitForTimeout(200);
  check('read mode shows journal', await page.isVisible('#room-analysis-chamber .qa'));
  check('map canvas hidden in read mode', !(await page.isVisible('#room-analysis-chamber .room-mapview')));
  await page.click('#room-analysis-chamber .rm-mapbtn');
  await page.waitForTimeout(300);
  check('map view restored', await page.isVisible('#room-analysis-chamber .room-mapview'));
  const pos2 = await page.evaluate(() => Rooms.snapshot());
  check('position preserved across views', Math.abs(pos2.pos.x - pos.pos.x) < 2 && Math.abs(pos2.pos.y - pos.pos.y) < 2,
    JSON.stringify(pos2.pos));

  // 9. per-room HUD progress
  await page.evaluate(() => App.openRoomByIndex(3, { side: 'forward' }));
  await page.waitForTimeout(300);
  const hudR = await page.textContent('#room-router-quest .rm-hud-local');
  check('router HUD research', /Research 0\/3/.test(hudR), hudR);

  await page.evaluate(() => App.openRoomByIndex(6, { side: 'forward' }));
  await page.waitForTimeout(300);
  const hudV = await page.textContent('#room-infographic-vault .rm-hud-local');
  check('vault HUD torches', /Torches 0\/5/.test(hudV), hudV);

  await page.evaluate(() => App.openRoomByIndex(5, { side: 'forward' }));
  await page.waitForTimeout(300);
  const hudA = await page.textContent('#room-plan-armory .rm-hud-local');
  check('armory HUD quests', /Quests 0 of 7/.test(hudA), hudA);

  await page.evaluate(() => App.openRoomByIndex(7, { side: 'forward' }));
  await page.waitForTimeout(300);
  const hudE = await page.textContent('#room-exit .rm-hud-local');
  check('exit HUD stats', /Chests 1\/12/.test(hudE), hudE);

  // 10. reload → state persists
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
  s = JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1')));
  check('opened chest survives reload', s.opened.indexOf('analysis-chamber/chest-01') >= 0);
  check('explored survives reload', s.explored.length >= 6, JSON.stringify(s.explored));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
