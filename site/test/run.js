/* Regression suite — Dungeon of Tabs (rooms + hallways). Run: node run.js */
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
  const getSave = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('dungeon-of-tabs-save-v1')));
  /* Wall-aware waypoint walker: nudges axis-by-axis at 64 px/s until the
     hero is within tol of the target; an axis that hits a wall and stops
     making progress is treated as satisfied. */
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

  /* ---------- 1. Gate opens as a playable map ---------- */
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
  check('Gate map view visible on load', await page.isVisible('#room-gate .room-mapview'));
  let s = await getSave();
  check('starts at 1/8 explored', s.explored.length === 1 && s.explored[0] === 0);
  check('save has rooms-engine fields', Array.isArray(s.opened) && s.view === 'map');

  /* ---------- 2. Gate exit threshold → hallway 1 ---------- */
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(3600); await page.keyboard.up('ArrowUp');
  await page.waitForSelector('#screen-hallway', { state: 'visible', timeout: 5000 });
  s = await getSave();
  check('hallway 1 entered at spawn (176,224)',
    s.hall && s.hall.i === 0 && s.hall.x === 176 && s.hall.y === 224, JSON.stringify(s.hall));
  check('crumb shows Hallway 01', (await page.textContent('#crumb-room')) === 'Hallway 01');
  await page.screenshot({ path: 'shots/01-hallway1.png' });

  /* ---------- 3. hallway collision still works ---------- */
  const h0 = await page.evaluate(() => Hallway.snapshot());
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(900); await page.keyboard.up('ArrowLeft');
  const h1 = await page.evaluate(() => Hallway.snapshot());
  check('hallway hero walks left', h1.x < h0.x - 15, h0.x + ' -> ' + h1.x);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowRight');
  const h2 = await page.evaluate(() => Hallway.snapshot());
  check('hallway hero walks back to spawn column', Math.abs(h2.x - h0.x) < 24, h2.x);

  /* ---------- 4. hallway destination → Profile Hall map ---------- */
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(4200); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400);
  check('Profile Hall opened via doorway (map view)', await page.isVisible('#room-profile-hall .room-mapview'));
  s = await getSave();
  check('explored is 2/8', s.explored.length === 2, JSON.stringify(s.explored));
  const hudP = await page.textContent('#room-profile-hall .rm-hud-x');
  check('room HUD shows explored 2/8', /Explored 2\/8/.test(hudP), hudP);
  await page.screenshot({ path: 'shots/02-profile-map.png' });

  /* ---------- 5. room return threshold → hallway arrival side ---------- */
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(450); await page.keyboard.up('ArrowDown');
  await page.waitForSelector('#screen-hallway', { state: 'visible', timeout: 5000 });
  s = await getSave();
  check('return doorway reopens hallway 1 at spawn',
    s.hall && s.hall.i === 0 && s.hall.x === 176 && s.hall.y === 224, JSON.stringify(s.hall));

  /* ---------- 6. back into Profile Hall, then fast travel to Analysis ---------- */
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(4200); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400);
  check('Profile Hall reopened after backtracking', await page.isVisible('#room-profile-hall .room-mapview'));
  await page.evaluate(() => App.openRoomByIndex(2, { side: 'forward' }));
  await page.waitForTimeout(400);
  check('Analysis Chamber map visible', await page.isVisible('#room-analysis-chamber .room-mapview'));
  const hudA = await page.textContent('#room-analysis-chamber .rm-hud-local');
  check('Analysis HUD chests 0/10', /Chests 0\/10/.test(hudA), hudA);
  await page.screenshot({ path: 'shots/03-analysis-map.png' });

  /* ---------- 7. chest interaction: loot once, repeat-safe ---------- */
  // waypoints: wall-stop at y=133 → col5 → row5 → col3, ending facing up
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1800); await page.keyboard.up('ArrowUp');
  await nudgeTo(80, 133, 2);
  await nudgeTo(80, 76, 2);
  await nudgeTo(48, 76, 2);
  await nudgeTo(48, 74, 2);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(40); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(250);
  const pos = await page.evaluate(() => Rooms.snapshot());
  check('stands at chest-01 interaction cell', pos.pos.x >= 38 && pos.pos.x <= 56 && pos.pos.y >= 65 && pos.pos.y <= 83,
    JSON.stringify(pos.pos));
  check('"Press Space" prompt shown', await page.isVisible('#room-analysis-chamber .rm-prompt'));
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  check('chest dialogue opened', await page.isVisible('#room-analysis-chamber .rm-dialog'));
  const dtitle = await page.textContent('#room-analysis-chamber .rm-dtitle');
  check('dialogue shows verbatim QA title', /content do you consume/i.test(dtitle), dtitle);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    if (!(await page.isVisible('#room-analysis-chamber .rm-dialog'))) break;
  }
  await page.waitForTimeout(300);
  s = await getSave();
  check('chest-01 opened and persisted', s.opened.indexOf('analysis-chamber/chest-01') >= 0, JSON.stringify(s.opened));
  check('global loot is 1', s.opened.length === 1, s.opened.length);
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    if (!(await page.isVisible('#room-analysis-chamber .rm-dialog'))) break;
  }
  await page.waitForTimeout(300);
  s = await getSave();
  check('reopening grants no extra loot', s.opened.length === 1, s.opened.length);
  const hudA2 = await page.textContent('#room-analysis-chamber .rm-hud-local');
  check('Analysis HUD chests 1/10', /Chests 1\/10/.test(hudA2), hudA2);

  /* ---------- 8. read mode toggle preserves state ---------- */
  await page.click('#room-analysis-chamber .rm-toggle');
  await page.waitForTimeout(200);
  check('read mode shows journal', await page.isVisible('#room-analysis-chamber .qa'));
  check('map hidden in read mode', !(await page.isVisible('#room-analysis-chamber .room-mapview')));
  await page.click('#room-analysis-chamber .rm-mapbtn');
  await page.waitForTimeout(300);
  const pos2 = await page.evaluate(() => Rooms.snapshot());
  check('map restored at same position',
    Math.abs(pos2.pos.x - pos.pos.x) < 2 && Math.abs(pos2.pos.y - pos.pos.y) < 2, JSON.stringify(pos2.pos));

  /* ---------- 9. fast travel preserves state; every room boots ---------- */
  for (const [i, sel, re] of [
    [3, '#room-router-quest', /Research 0\/3/],
    [4, '#room-reel-trap', /Reels 0/],
    [5, '#room-plan-armory', /Quests 0 of 7/],
    [6, '#room-infographic-vault', /Torches 0\/5/],
    [7, '#room-exit', /Chests 1\/12/]
  ]) {
    await page.evaluate(n => App.openRoomByIndex(n, { side: 'forward' }), i);
    await page.waitForTimeout(300);
    const visible = await page.isVisible(sel + ' .room-mapview');
    const hud = await page.textContent(sel + ' .rm-hud-local');
    check('room ' + i + ' map boots with HUD', visible && re.test(hud), hud);
  }
  await page.screenshot({ path: 'shots/04-exit-map.png' });

  /* ---------- 10. reduced motion: dialogue reveals instantly ---------- */
  // Hero is in the Exit room at its spawn (64,224). The exit-marker stand is
  // (13,7): cross at row14 to col9, climb to y=107, cross to col13.
  // y=107 (not 102): the cross must keep the feet out of row6 — col12/13 are
  // solid there (chest prop), and arrival tol + keyup drift could dip to y=100
  // (t=111 → row6), walling the walk at x=180 before col13.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await nudgeTo(144, 224, 2);
  await nudgeTo(144, 107, 2);
  await nudgeTo(207, 107, 2);
  await nudgeTo(207, 112, 2);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(140); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(250);
  const epos = await page.evaluate(() => Rooms.snapshot());
  if (await page.isVisible('#room-exit .rm-prompt')) {
    await page.keyboard.press('e');
    await page.waitForTimeout(120);
    const bodyLen = (await page.textContent('#room-exit .rm-dbody')).length;
    check('reduced motion reveals dialogue text instantly', bodyLen > 40, bodyLen);
    const stats = await page.textContent('#room-exit .rm-dbody');
    check('final stats reflect actual counts', /Rooms explored: 8 \/ 8/.test(stats), stats.slice(0, 80));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check('Escape closes dialogue', !(await page.isVisible('#room-exit .rm-dialog')));
  } else {
    check('reduced motion: exit marker reachable', false, JSON.stringify(epos && epos.pos));
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---------- 11. reload persistence ---------- */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
  s = await getSave();
  check('opened chest survives reload', s.opened.indexOf('analysis-chamber/chest-01') >= 0);
  check('explored rooms survive reload', s.explored.length >= 7, JSON.stringify(s.explored));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
