'use strict';

/* Hallway engine — canvas rendering, collision, movement, input, doorway triggers. */

const Hallway = (() => {
  const canvas = document.getElementById('hallway-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.W;
  canvas.height = WORLD.H;
  ctx.imageSmoothingEnabled = false;

  const state = {
    index: -1, grid: null, k: { x: 0, y: 0, dir: 'down' },
    armedDest: true, armedArrival: true, held: [],
    raf: 0, lastT: 0, walkT: 0, moving: false, lastSaveT: 0,
    mapImg: null, ready: false, maps: {}, entry: 'forward'
  };

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const spriteCache = {};

  function preload() {
    const jobs = [];
    for (let i = 1; i <= 7; i++) {
      jobs.push(new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('map ' + i));
        img.src = 'assets/maps/hallway-' + i + '.png';
      }).then(img => { state.maps[i] = img; }));
    }
    for (const d of ['down', 'up', 'left', 'right']) for (const p of ['idle', 'walk1', 'walk2']) {
      jobs.push(new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('sprite ' + d + '-' + p));
        img.src = 'assets/hero/' + d + '-' + p + '.png';
      }).then(img => { spriteCache[d + '-' + p] = img; }));
    }
    return Promise.all(jobs);
  }

  function feetRect(x, y) {
    // feet collision rectangle: x 4–12, y 11–15 relative to sprite top-left (inclusive)
    return { l: x + 4, t: y + 11, r: x + 12, b: y + 15 };
  }

  function cellsOpen(x, y) {
    const f = feetRect(x, y);
    const c1 = Math.floor(f.l / 16), c2 = Math.floor(f.r / 16);
    const r1 = Math.floor(f.t / 16), r2 = Math.floor(f.b / 16);
    if (c1 < 0 || r1 < 0 || c2 >= WORLD.COLS || r2 >= WORLD.ROWS) return false;
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      if (!state.grid[r][c]) return false;
    }
    return true;
  }

  function overlapsCell(x, y, cell) {
    const f = feetRect(x, y);
    const cl = cell[0] * 16, ct = cell[1] * 16;
    return f.l <= cl + 15 && f.r >= cl && f.t <= ct + 15 && f.b >= ct;
  }

  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right', W: 'up', A: 'left', S: 'down', D: 'right'
  };
  const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

  function pushDir(dir) {
    if (state.index < 0) return;
    const i = state.held.indexOf(dir);
    if (i >= 0) state.held.splice(i, 1);
    state.held.push(dir);
    updateDpadPressed();
  }
  function removeDir(dir) {
    const i = state.held.indexOf(dir);
    if (i >= 0) state.held.splice(i, 1);
    updateDpadPressed();
  }
  function clearHeld() { state.held.length = 0; updateDpadPressed(); }
  function activeDir() { return state.held.length ? state.held[state.held.length - 1] : null; }

  function updateDpadPressed() {
    const act = activeDir();
    document.querySelectorAll('.dpad-btn').forEach(b => {
      b.classList.toggle('is-pressed', b.dataset.dir === act);
    });
  }

  function isFormTarget(e) {
    const t = e.target;
    if (!t) return false;
    return FORM_TAGS.has(t.tagName) || t.isContentEditable === true;
  }

  function bindInput() {
    window.addEventListener('keydown', e => {
      if (state.index < 0 || isFormTarget(e)) return;
      const dir = KEYMAP[e.key];
      if (!dir) return;
      e.preventDefault();
      if (!e.repeat) pushDir(dir);
    });
    window.addEventListener('keyup', e => { const d = KEYMAP[e.key]; if (d) removeDir(d); });
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeld(); });

    document.querySelectorAll('.dpad-btn').forEach(btn => {
      const dir = btn.dataset.dir;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (_) {} }
        pushDir(dir);
      });
      btn.addEventListener('pointerup', () => removeDir(dir));
      btn.addEventListener('pointercancel', () => removeDir(dir));
      btn.addEventListener('lostpointercapture', () => removeDir(dir));
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
    window.addEventListener('pointerup', clearHeld);
    window.addEventListener('pointercancel', clearHeld);

    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.index < 0) return;
        const dir = btn.dataset.dir;
        const [dx, dy] = DIRS[dir];
        state.k.dir = dir;
        if (tryMove(state.k.x + dx * WORLD.TILE, state.k.y + dy * WORLD.TILE)) afterMove();
        draw();
      });
    });
  }

  /* ---------- movement ---------- */
  function tryMove(nx, ny) {
    if (cellsOpen(nx, ny)) { state.k.x = nx; state.k.y = ny; return true; }
    return false;
  }

  function afterMove() { checkTriggers(); App.save(); }

  function checkTriggers() {
    const h = HALLWAYS[state.index];
    if (state.armedDest && h.dest.some(c => overlapsCell(state.k.x, state.k.y, c))) {
      state.armedDest = false;
      state.entry = 'forward';
      clearHeld();
      App.openRoomByIndex(state.index + 1, { hall: state.index, side: 'forward' });
      return;
    }
    if (!state.armedDest && !h.dest.some(c => overlapsCell(state.k.x, state.k.y, c))) {
      state.armedDest = true;
    }
    if (state.armedArrival && h.arrival.some(c => overlapsCell(state.k.x, state.k.y, c))) {
      state.armedArrival = false;
      state.entry = 'arrival';
      clearHeld();
      App.openRoomByIndex(state.index, { hall: state.index, side: 'arrival' });
      return;
    }
    if (!state.armedArrival && !h.arrival.some(c => overlapsCell(state.k.x, state.k.y, c))) {
      state.armedArrival = true;
    }
  }

  function loop(t) {
    if (state.index < 0) return;
    const dt = Math.min((t - state.lastT) / 1000, 0.05);
    state.lastT = t;
    const wasMoving = state.moving;
    const dir = activeDir();
    if (dir) {
      state.k.dir = dir;
      const [dx, dy] = DIRS[dir];
      const moved = tryMove(state.k.x + dx * SPEED * dt, state.k.y + dy * SPEED * dt);
      state.moving = moved;
      if (moved) {
        state.walkT += dt;
        checkTriggers();
        if (t - state.lastSaveT > 400) { App.save(); state.lastSaveT = t; }
      }
    } else {
      state.moving = false;
    }
    // persist whenever movement stops (wall, key release, doorway)
    if (wasMoving && !state.moving) { App.save(); state.lastSaveT = t; }
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function currentSprite() {
    const key = state.k.dir + '-';
    if (state.moving) {
      const pose = Math.floor(state.walkT * POSE_FPS) % 2 === 0 ? 'walk1' : 'walk2';
      return spriteCache[key + pose] || spriteCache[key + 'idle'];
    }
    return spriteCache[key + 'idle'];
  }

  function draw() {
    if (!state.mapImg) return;
    ctx.clearRect(0, 0, WORLD.W, WORLD.H);
    ctx.drawImage(state.mapImg, 0, 0, WORLD.W, WORLD.H);
    const spr = currentSprite();
    if (spr) ctx.drawImage(spr, Math.round(state.k.x), Math.round(state.k.y), 16, 16);
  }

  function fit() {
    const frame = document.getElementById('hallway-canvas-frame');
    if (!frame) return;
    const cs = getComputedStyle(frame);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const cw = frame.clientWidth - padX;
    let scale = Math.floor(cw / WORLD.W);
    if (scale < 1) scale = 1;
    if (scale > 3) scale = 3;
    canvas.style.width = (WORLD.W * scale) + 'px';
    canvas.style.height = (WORLD.H * scale) + 'px';
  }

  /* ---------- public ---------- */
  function announce() {
    const h = HALLWAYS[state.index];
    const el = document.getElementById('hallway-guide');
    if (el) {
      el.textContent = 'Hallway ' + h.n + ' of 7 · ' + ROOMS[state.index].name + ' → ' +
        ROOMS[state.index + 1].name + '. Walk into the gold destination doorway at the top to open ' +
        ROOMS[state.index + 1].name + '. The doorway behind you reopens ' + ROOMS[state.index].name + '.';
    }
  }

  function enter(index, restore) {
    state.index = index;
    state.grid = buildGrid(HALLWAYS[index]);
    state.mapImg = state.maps[index + 1];
    const h = HALLWAYS[index];

    if (restore && typeof restore.x === 'number' && cellsOpen(restore.x, restore.y)) {
      state.k.x = restore.x; state.k.y = restore.y; state.k.dir = restore.dir || 'down';
    } else {
      state.k.x = h.spawn[0] * 16;
      state.k.y = h.spawn[1] * 16;
      state.k.dir = 'down';
    }
    state.armedDest = true;
    state.armedArrival = true;
    clearHeld();
    // if restored on a trigger cell, require leaving before it fires
    if (h.dest.some(c => overlapsCell(state.k.x, state.k.y, c))) state.armedDest = false;
    if (h.arrival.some(c => overlapsCell(state.k.x, state.k.y, c))) state.armedArrival = false;

    fit();
    draw();
    cancelAnimationFrame(state.raf);
    state.lastT = performance.now();
    state.raf = requestAnimationFrame(loop);
    announce();

    const st = document.getElementById('hallway-status');
    if (st) st.textContent = 'Hallway ' + h.n + ' of 7 — ' + h.title + '. Destination: ' + ROOMS[index + 1].name + '.';
    const destLabel = document.getElementById('dest-label');
    if (destLabel) destLabel.textContent = ROOMS[index + 1].name;
    const hallLabel = document.getElementById('hall-chip');
    if (hallLabel) hallLabel.textContent = 'HALLWAY 0' + h.n + ' / 07 · ' +
      ROOMS[index].name.toUpperCase() + ' → ' + ROOMS[index + 1].name.toUpperCase();
    const hallTitle = document.getElementById('hall-title');
    if (hallTitle) hallTitle.textContent = h.title;
    const hallCaption = document.getElementById('hall-caption');
    if (hallCaption) hallCaption.textContent = h.caption;
    const hallNum = document.getElementById('hall-eyebrow');
    if (hallNum) hallNum.textContent = 'HALLWAY 0' + h.n + ' OF 07';
  }

  function exit() {
    state.index = -1;
    clearHeld();
    cancelAnimationFrame(state.raf);
  }

  function snapshot() {
    if (state.index < 0) return null;
    return { i: state.index, x: Math.round(state.k.x), y: Math.round(state.k.y), dir: state.k.dir };
  }

  return {
    preload: () => preload().then(() => { state.ready = true; }),
    bindInput, enter, exit, fit, snapshot,
    debug: () => {
      if (state.index < 0) return { i: -1 };
      const f = feetRect(state.k.x, state.k.y);
      const c1 = Math.floor(f.l / 16), c2 = Math.floor(f.r / 16);
      const r1 = Math.floor(f.t / 16), r2 = Math.floor(f.b / 16);
      const cells = [];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) cells.push([c, r, state.grid[r][c]]);
      return { i: state.index, x: state.k.x, y: state.k.y, dir: state.k.dir,
               held: state.held.slice(), moving: state.moving, raf: state.raf, cells };
    }
  };
})();

