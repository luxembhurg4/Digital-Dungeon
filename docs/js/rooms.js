'use strict';

/* ============================================================
 * Rooms engine — playable room maps (master plan §4–§9).
 * Movement, collision, interaction, dialogue, HUD, read mode.
 * Reuses Hallway input patterns; state persists via App save.
 * ============================================================ */

const Rooms = (() => {
  const state = {
    i: -1, grid: null, k: { x: 0, y: 0, dir: 'up' }, held: [],
    view: 'map',                        // 'map' | 'read'
    dialog: null,                       // { title, pages, page, typing, after, control }
    armedExit: true, armedReturn: true, transitioning: false,
    raf: 0, lastT: 0, walkT: 0, moving: false, lastSaveT: 0,
    eligible: null, widget: null, section: null, mapBtn: null
  };

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right', W: 'up', A: 'left', S: 'down', D: 'right'
  };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- assets ---------- */
  const imgs = { terrains: {}, props: {}, hero: {}, monster: null };
  const PROP_FILES = [
    'banner-gold', 'archive-shelf', 'scroll', 'chest-closed', 'chest-open', 'router',
    'cable-h', 'cable-v', 'armory-rack', 'potion', 'torch-lit', 'torch-unlit',
    'skull', 'exit-marker'
  ];

  const RETRIES = 2;
  function loadImgNTimes(src, label, triesLeft, res, rej) {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => {
      if (triesLeft > 0) {
        setTimeout(() => loadImgNTimes(src, label, triesLeft - 1, res, rej), 400);
      } else {
        rej(new Error(label + ' (' + src + ')'));
      }
    };
    img.src = src + (src.indexOf('?') < 0 ? '?v=1' : '&v=1');
  }
  function loadImg(src, label) {
    return new Promise((res, rej) => loadImgNTimes(src, label, RETRIES, res, rej));
  }

  function preload() {
    const jobs = [];
    ROOM_FIELDS.forEach((f, i) => {
      jobs.push(loadImg(f.terrain, 'room terrain ' + i).then(img => { imgs.terrains[i] = img; }));
    });
    for (const p of PROP_FILES) {
      jobs.push(loadImg('assets/prop/' + p + '.png', 'prop ' + p).then(img => { imgs.props[p] = img; }));
    }
    for (const d of ['down', 'up', 'left', 'right']) for (const pose of ['idle', 'walk1', 'walk2']) {
      jobs.push(loadImg('assets/hero/' + d + '-' + pose + '.png', 'sprite ' + d + '-' + pose)
        .then(img => { imgs.hero[d + '-' + pose] = img; }));
    }
    jobs.push(loadImg('assets/hero/monster.png', 'reel monster').then(img => { imgs.monster = img; }));
    return Promise.all(jobs);
  }

  /* ---------- DOM refs (lazily built) ---------- */
  const dom = {
    canvas: null, ctx: null, stage: null, prompt: null,
    dialog: null, dtitle: null, dbody: null, dpage: null,
    nextBtn: null, closeBtn: null, questBox: null, qcheck: null, qlabel: null,
    hudRoom: null, hudX: null, hudLoot: null, hudLocal: null,
    toggle: null, act: null, dpad: null
  };

  function buildWidget() {
    const w = document.createElement('div');
    w.className = 'room-mapview';
    w.innerHTML =
      '<div class="rm-toolbar">' +
        '<div class="rm-hud">' +
          '<span class="rm-hud-room"></span>' +
          '<span class="rm-hud-x"></span>' +
          '<span class="rm-hud-loot"></span>' +
          '<span class="rm-hud-local" hidden></span>' +
        '</div>' +
        '<button type="button" class="rm-toggle">▤ Read mode</button>' +
      '</div>' +
      '<div class="rm-stage" tabindex="0" aria-label="Room map. Move with arrow keys, WASD or the D-pad. Interact with Space, Enter or the A button.">' +
        '<canvas id="room-canvas" width="384" height="288"></canvas>' +
        '<div class="rm-prompt" hidden>Press Space</div>' +
        '<div class="rm-dialog" role="dialog" aria-label="Dialogue" hidden>' +
          '<p class="rm-dtitle"></p>' +
          '<p class="rm-dbody"></p>' +
          '<div class="rm-dfoot">' +
            '<label class="rm-quest" hidden><input type="checkbox" class="rm-qcheck"> <span class="rm-qlabel"></span></label>' +
            '<span class="rm-dpage"></span>' +
            '<button type="button" class="rm-next">Next ▸</button>' +
            '<button type="button" class="rm-close">Close ✕</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rm-controls">' +
        '<div class="rm-dpad">' +
          '<button type="button" class="rm-db up" data-dir="up" aria-label="Move up"></button>' +
          '<button type="button" class="rm-db left" data-dir="left" aria-label="Move left"></button>' +
          '<button type="button" class="rm-db right" data-dir="right" aria-label="Move right"></button>' +
          '<button type="button" class="rm-db down" data-dir="down" aria-label="Move down"></button>' +
        '</div>' +
        '<button type="button" class="rm-act" aria-label="Interact">A<span class="rm-act-label">Interact</span></button>' +
      '</div>';
    dom.canvas = w.querySelector('#room-canvas');
    dom.ctx = dom.canvas.getContext('2d');
    dom.ctx.imageSmoothingEnabled = false;
    dom.stage = w.querySelector('.rm-stage');
    dom.prompt = w.querySelector('.rm-prompt');
    dom.dialog = w.querySelector('.rm-dialog');
    dom.dtitle = w.querySelector('.rm-dtitle');
    dom.dbody = w.querySelector('.rm-dbody');
    dom.dpage = w.querySelector('.rm-dpage');
    dom.nextBtn = w.querySelector('.rm-next');
    dom.closeBtn = w.querySelector('.rm-close');
    dom.questBox = w.querySelector('.rm-quest');
    dom.qcheck = w.querySelector('.rm-qcheck');
    dom.qlabel = w.querySelector('.rm-qlabel');
    dom.hudRoom = w.querySelector('.rm-hud-room');
    dom.hudX = w.querySelector('.rm-hud-x');
    dom.hudLoot = w.querySelector('.rm-hud-loot');
    dom.hudLocal = w.querySelector('.rm-hud-local');
    dom.toggle = w.querySelector('.rm-toggle');
    dom.act = w.querySelector('.rm-act');
    dom.dpad = w.querySelector('.rm-dpad');
    return w;
  }

  /* ---------- fit / scaling ---------- */
  /* Measure the mapview container, NOT the stage: the stage is inline-block
     and shrink-wraps to the canvas, which would pin the scale at 1×.
     Height guard: only step up to 3× (864px) when the viewport can hold it
     (canvas + toolbar + controls ≈ 300px of chrome); 2× is always allowed. */
  function fit() {
    if (!dom.canvas || !dom.stage) return;
    const host = dom.stage.parentElement;
    const availW = (host && host.clientWidth) || WORLD.W;
    const byW = Math.floor(availW / WORLD.W);
    const byH = Math.floor(Math.max(0, (window.innerHeight || 0) - 300) / WORLD.H);
    const scale = Math.max(1, Math.min(3, byW, Math.max(2, byH)));
    dom.canvas.style.width = (WORLD.W * scale) + 'px';
    dom.canvas.style.height = (WORLD.H * scale) + 'px';
  }

  /* ---------- held-input helpers (Hallway pattern) ---------- */
  function isFormTarget(e) {
    const t = e.target;
    return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable]'));
  }
  function pushDir(dir) {
    if (state.i < 0 || state.view !== 'map' || state.dialog) return;
    const idx = state.held.indexOf(dir);
    if (idx >= 0) state.held.splice(idx, 1);
    state.held.push(dir);
    updatePressed();
  }
  function removeDir(dir) {
    const idx = state.held.indexOf(dir);
    if (idx >= 0) state.held.splice(idx, 1);
    updatePressed();
  }
  function clearHeld() { state.held.length = 0; updatePressed(); }
  function activeDir() { return state.held.length ? state.held[state.held.length - 1] : null; }
  function updatePressed() {
    const act = activeDir();
    if (!dom.dpad) return;
    dom.dpad.querySelectorAll('.rm-db').forEach(b => {
      b.classList.toggle('is-pressed', !state.dialog && b.dataset.dir === act);
    });
  }
  function setControlsDisabled(off) {
    if (dom.act) dom.act.classList.toggle('is-disabled', !!off);
    if (dom.dpad) dom.dpad.classList.toggle('is-off', !!off);
    updatePressed();
  }

  /* ---------- collision (feet hitbox, Hallway pattern) ---------- */
  function feetRect(x, y) {
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
  function overlapsCell(cell) {
    const f = feetRect(state.k.x, state.k.y);
    const cl = cell[0] * 16, ct = cell[1] * 16;
    return f.l <= cl + 15 && f.r >= cl && f.t <= ct + 15 && f.b >= ct;
  }
  function heroCell() {
    return [Math.floor((state.k.x + 8) / 16), Math.floor((state.k.y + 13) / 16)];
  }

  function move(dir, dt) {
    state.k.dir = dir;
    const d = DIRS[dir];
    const step = SPEED * dt;
    if (d[0]) {
      const nx = state.k.x + d[0] * step;
      if (cellsOpen(nx, state.k.y)) state.k.x = nx;
    }
    if (d[1]) {
      const ny = state.k.y + d[1] * step;
      if (cellsOpen(state.k.x, ny)) state.k.y = ny;
    }
    state.moving = true;
    state.walkT += dt;
  }

  /* ---------- doorway triggers ---------- */
  function checkTriggers() {
    if (state.dialog || state.transitioning) return;
    const f = ROOM_FIELDS[state.i];
    const onExit = f.exitCells.some(c => overlapsCell(c));
    if (state.armedExit && onExit) return fireExit();
    if (onExit) state.armedExit = false; else state.armedExit = true;
    const onReturn = f.returnCells.some(c => overlapsCell(c));
    if (state.armedReturn && onReturn) return fireReturn();
    if (onReturn) state.armedReturn = false; else state.armedReturn = true;
  }
  function fireExit() {
    state.transitioning = true;
    clearHeld();
    if (state.i < 7) { App.enterHallway(state.i, null); return; }
    // Exit room · last door → proper ending before returning to the Gate (§18)
    const opened = App.openedIds().filter(id => LOOT_CHESTS.indexOf(id) >= 0).length;
    state.transitioning = false;
    openDialogue({
      title: 'The Last Door',
      pages: [
        'Rooms explored: ' + App.exploredCount() + ' / 8 · Reward chests opened: ' +
          opened + ' / 12 · Global loot: ' + App.lootCount() + ' / 12 · Wellness quests: ' +
          App.questCount() + ' / 7.',
        'May the treasures you found guide you towards a more responsible digital citizen.',
        'Keep the skills. Reclaim the hours. — James Carl M. Osio'
      ],
      after: 'gate'
    });
  }
  function fireReturn() {
    state.transitioning = true;
    clearHeld();
    const h = HALLWAYS[state.i - 1];
    App.enterHallway(state.i - 1,
      { x: h.spawn[0] * 16, y: h.spawn[1] * 16, dir: 'down' });
  }

  /* ---------- interaction eligibility (§7) ---------- */
  function updateEligible() {
    state.eligible = null;
    if (state.i < 0 || state.dialog || state.view !== 'map' || state.transitioning) {
      syncPrompt();
      return;
    }
    const [cx, cy] = heroCell();
    const objects = ROOM_FIELDS[state.i].objects;
    // Pass 1 (original rule): facing the exact object cell — precise ties.
    const d = DIRS[state.k.dir];
    for (const o of objects) {
      if (o.obj[0] === cx + d[0] && o.obj[1] === cy + d[1]) { state.eligible = o; break; }
    }
    // Pass 2 (forgiving): hero anywhere in the object's 3×3 block — so the
    // prompt doesn't require pixel-perfect standing/facing, and stays up while
    // the hero is still inside the block instead of flickering off.
    if (!state.eligible) {
      for (const o of objects) {
        if (Math.abs(o.obj[0] - cx) <= 1 && Math.abs(o.obj[1] - cy) <= 1) { state.eligible = o; break; }
      }
    }
    syncPrompt();
  }
  function syncPrompt() {
    if (!dom.prompt) return;
    dom.prompt.hidden = !state.eligible;
    // A button: only enabled when something is interactable. D-pad: only off
    // while a dialogue locks movement — it must stay live for walking.
    if (dom.act) dom.act.classList.toggle('is-disabled', !state.eligible || !!state.dialog);
    if (dom.dpad) dom.dpad.classList.toggle('is-off', !!state.dialog);
    updatePressed();
  }

  /* ---------- dialogue (§8) ---------- */
  let typeTimer = null;
  function stopTyping() { if (typeTimer) { clearInterval(typeTimer); typeTimer = null; } }

  function openDialogue(d) {
    clearHeld();
    stopTyping();
    state.dialog = {
      title: d.title, pages: d.pages, page: 0, typing: false,
      after: d.after || null, control: d.control || null
    };
    dom.dialog.hidden = false;
    dom.dtitle.textContent = d.title;
    dom.questBox.hidden = !d.control;
    if (d.control) {
      dom.qlabel.textContent = d.control.label;
      dom.qcheck.checked = !!d.control.checked;
      dom.qcheck.onchange = () => d.control.onChange(dom.qcheck.checked);
    }
    renderPage();
    updateHud();
  }

  function renderPage() {
    const dlg = state.dialog;
    const text = dlg.pages[dlg.page] || '';
    dom.dpage.textContent = (dlg.page + 1) + ' / ' + dlg.pages.length;
    dom.nextBtn.textContent = dlg.page >= dlg.pages.length - 1 ? 'Close ✕' : 'Next ▸';
    if (reduced()) {
      dom.dbody.textContent = text;
      dlg.typing = false;
      return;
    }
    dom.dbody.textContent = '';
    dlg.typing = true;
    let pos = 0;
    stopTyping();
    typeTimer = setInterval(() => {
      pos += 2;
      dom.dbody.textContent = text.slice(0, pos);
      if (pos >= text.length) {
        dom.dbody.textContent = text;
        state.dialog.typing = false;
        stopTyping();
      }
    }, 24);
  }

  function finishTyping() {
    const dlg = state.dialog;
    stopTyping();
    dom.dbody.textContent = dlg.pages[dlg.page] || '';
    dlg.typing = false;
  }

  function advance() {
    const dlg = state.dialog;
    if (!dlg) return;
    if (dlg.typing) return finishTyping();
    if (dlg.page < dlg.pages.length - 1) {
      dlg.page += 1;
      renderPage();
    } else {
      closeDialogue();
    }
  }

  function closeDialogue() {
    const dlg = state.dialog;
    if (!dlg) return;
    stopTyping();
    state.dialog = null;
    dom.dialog.hidden = true;
    clearHeld();
    updateHud();
    if (dlg.after === 'read') { showRead(); if (typeof App !== 'undefined' && App.reelFightStart) App.reelFightStart(); }
    else if (dlg.after === 'gate') App.openRoomByIndex(0, null);   // ending → back to the Gate
    else if (dom.stage) dom.stage.focus({ preventScroll: true });
  }

  /* ---------- content extraction (existing wording is authoritative) ---------- */
  function textOf(sel, root) {
    const el = (root || document).querySelector(sel);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function paras(sel) {
    return Array.from(document.querySelectorAll(sel))
      .map(el => el.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  function paginate(text, max) {
    max = max || 165;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const out = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; }
      else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  }

  function qaContent(idx) {
    const qa = document.querySelectorAll('#room-analysis-chamber .qa')[idx];
    if (!qa) return { title: 'Answer', pages: [''] };
    const sum = qa.querySelector('summary');
    const title = (sum ? sum.textContent : '')
      .replace('▣', '').replace(/\s+/g, ' ').trim();
    const body = qa.querySelector('p') ? qa.querySelector('p').textContent.trim() : '';
    return { title, pages: paginate(body) };
  }

  function appContent(name) {
    let pct = '', hrs = '';
    document.querySelectorAll('#room-profile-hall .bar-row').forEach(row => {
      if (textOf('.bar-name', row) === name) {
        pct = textOf('.bar-pct', row); hrs = textOf('.bar-hrs', row);
      }
    });
    let time = '', purpose = '', effect = '', activity = '';
    document.querySelectorAll('#room-profile-hall .activity-table tbody tr').forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      if (tds[1] === name) { activity = tds[0]; time = tds[2]; purpose = tds[3]; effect = tds[4]; }
    });
    const pages = [];
    if (pct || hrs) pages.push(name + ' — ' + pct + ' of active screen time, ' + hrs + '.');
    pages.push(activity + ' · ' + time + '. Purpose: ' + purpose + '. Effect on me: ' + effect + '.');
    return { title: name, pages: pages.flatMap(p => paginate(p)) };
  }

  function rowsToText() {
    const out = [];
    document.querySelectorAll('#room-profile-hall .activity-table tbody tr').forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      out.push(tds.join(' · '));
    });
    return out.join(' ');
  }

  function reelClockText() {
    const total = (21 * 60 + 17 * App.reelCount()) % (24 * 60);
    let h = Math.floor(total / 60);
    const m = total % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  /* Build the dialogue payload for an object, applying state rules (§11–§18). */
  function contentFor(o) {
    const say = o.say;
    switch (o.type) {
      case 'banner': {
        if (say === 'gate-profile') {
          const title = textOf('#room-gate .profile-card .parch-title') || textOf('.author-name') || 'Adventurer Profile';
          const stats = Array.from(document.querySelectorAll('#room-gate .stat')).map(s =>
            textOf('.stat-label', s) + ': ' + textOf('.stat-value', s) +
            (textOf('.stat-note', s) ? ' — ' + textOf('.stat-note', s) : '')).join(' ');
          if (stats) return { title, pages: paginate(stats) };
          // Profile card was replaced by the How to Play guide — describe the
          // adventurer from the live sidebar/hero copy instead of showing nothing.
          const who = textOf('.author-name') + ' · ' + textOf('.author-class');
          const intro = textOf('#room-gate .gate-hero-text p');
          return { title, pages: paginate(who + '. ' + intro) };
        }
        if (say === 'router-intro') {
          return {
            title: textOf('#router-intro .dark-label') || 'Quest briefing',
            pages: paginate(textOf('#router-intro p:not(.dark-label)'))
          };
        }
        return { title: say, pages: [''] };
      }
      case 'app':
        App.markBanner(o.id);          // reading an app banner collects it (Profile Hall lock, §12)
        return appContent(say);
      case 'shelf': {
        // One activity per page, structured lines (white-space: pre-wrap)
        const pages = [];
        document.querySelectorAll('#room-profile-hall .activity-table tbody tr').forEach(tr => {
          const t = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          if (t.length >= 5) pages.push(t[0] + ' · ' + t[1] + ' · ' + t[2] +
            '\nPurpose: ' + t[3] + '\nEffect: ' + t[4]);
        });
        // Lock the Full Inventory until all app banners are collected
        const inventoryLocked = !App.allBannersCollected() && state.i === 1;
        if (inventoryLocked) {
          return {
            title: 'The full inventory · 7 activities',
            pages: ['This inventory is locked. Collect all 6 app banners first, then return to the shelf.']
          };
        }
        return {
          title: 'The full inventory · ' + pages.length + ' activities',
          pages: pages.length ? pages : ['']
        };
      }
      case 'scroll':
        return {
          title: 'Measures scroll',
          pages: paginate(textOf('#room-profile-hall .chart-card .parch-title') + ' ' +
            textOf('#room-profile-hall .parch-foot'))
        };
      case 'chest': {
        if (say === 'router-lesson') {
          const rc = App.researchCount();
          if (rc < 3) {
            return {
              title: 'The lesson chest',
              pages: ['The lesson chest unlocks after all three research scrolls are collected. Research: ' +
                rc + ' / 3.']
            };
          }
        }
        let base;
        if (say.indexOf('qa-') === 0) {
          base = qaContent(Number(say.slice(3)));
        } else if (say === 'router-lesson') {
          base = {
            title: 'The lesson',
            pages: paginate(paras('#room-router-quest .loot-banner p').slice(-1)[0])
          };
        } else if (say === 'exit-chest') {
          base = {
            title: 'The last chest',
            pages: paginate((textOf('#room-exit .exit-pledge') || 'One hour a day. Not one more lost night.') +
              ' ' + paras('#room-exit .parchment p').slice(-1)[0])
          };
        } else {
          base = { title: 'Chest', pages: [''] };
        }
        const isNew = App.markChest(o.id);
        base.pages = base.pages.concat(paginate(
          isNew
            ? 'Loot gained: +1. Global loot: ' + App.lootCount() + ' / 12.'
            : 'This chest was already opened — its loot is claimed only once. Answer shown again, no new loot.'
        ));
        return base;
      }
      case 'router': {
        const cards = document.querySelectorAll('#room-router-quest .story-card');
        const first = cards[0], last = cards[cards.length - 1];
        if (App.researchCount() < 3) {
          return {
            title: textOf('h3', first) || 'The router',
            pages: paginate(paras('#room-router-quest .story-card p').slice(-1)[0])
          };
        }
        return {
          title: textOf('h3', last) || 'The real fix',
          pages: paginate(paras('#room-router-quest .parchment.story-card p:not(.parch-label)').slice(-1)[0])
        };
      }
      case 'cable': {
        App.setFlag('workaround', true);
        const all = paras('#room-router-quest .story-card p').join(' ');
        const sentence = all.split(/(?<=\.)\s+/).filter(s => s.toLowerCase().indexOf('workaround') >= 0).join(' ');
        return {
          title: 'A workaround was not the answer.',
          pages: paginate(sentence || all)
        };
      }
      case 'research': {
        App.addResearch(o.id);
        const scrollText = {
          'research-youtube': '#scroll-youtube',
          'research-forums': '#scroll-forums',
          'research-ai': '#scroll-ai'
        }[o.id];
        const pages = scrollText ? paginate(textOf(scrollText)) :
          paginate(textOf('#room-router-quest .parchment.story-card p:not(.parch-label)'));
        return {
          title: (pages[0] || 'Research scroll').split(':')[0],
          pages: pages
            .concat(paginate('Research progress: ' + App.researchCount() + ' / 3.'))
            .concat(paginate(textOf('#scroll-result')))
        };
      }
      case 'monster':
        return {
          title: 'The Reel Monster',
          pages: paginate(textOf('#room-reel-trap .room-sub')),
          after: 'read'
        };
      case 'rack': {
        // say 'quest-N' is the 0-based WELLNESS index → DAY 01..07 (was DAY 00 + empty)
        const n = Number(say.split('-')[1]);
        return {
          title: 'DAY ' + String(n + 1).padStart(2, '0'),
          pages: paginate(WELLNESS[n]),
          control: {
            label: 'Mark this day complete',
            checked: App.getQuest(n),
            onChange: on => { App.setQuest(n, on); updateHud(); App.save(); }
          }
        };
      }
      case 'torch': {
        App.lightTorch(o.id);
        const n = Number(say.split('-')[1]);
        const habit = textOf('#room-infographic-vault .habit-list li:nth-child(' + (n + 1) + ')');
        return {
          title: 'Habit torch ' + (n + 1) + ' / 5',
          pages: paginate(habit).concat(paginate('Torches lit: ' + App.torchCount() + ' / 5.'))
        };
      }
      case 'archive': {
        const good = say === 'vault-benefits';
        const items = paras(good ? '#room-infographic-vault .br-good li' : '#room-infographic-vault .br-bad li');
        return {
          title: good ? 'Three positive effects' : 'Three risks',
          pages: paginate(items.join(' '))
        };
      }
      case 'pledge': {
        const lit = App.torchCount();
        if (lit < 5) {
          return {
            title: 'The pledge scroll',
            pages: ['Five habit torches reveal the pledge. Torches lit: ' + lit + ' / 5.']
          };
        }
        const pledge = textOf('#room-infographic-vault .pledge-text');
        const takeaway = paras('#room-infographic-vault .class-idea p').join(' ');
        const sign = textOf('#room-infographic-vault .pledge-sign');
        return { title: 'My pledge', pages: paginate(pledge + ' ' + takeaway + ' ' + sign) };
      }
      case 'marker': {
        const opened = App.openedIds().filter(id => LOOT_CHESTS.indexOf(id) >= 0).length;
        return {
          title: 'Final statistics',
          pages: [
            'Rooms explored: ' + App.exploredCount() + ' / 8 · Reward chests opened: ' +
              opened + ' / 12 · Global loot: ' + App.lootCount() + ' / 12 · Wellness quests: ' +
              App.questCount() + ' / 7.',
            textOf('#room-exit .cleared-title') + ' ' + textOf('#room-exit .sig-name') +
              ' · ' + textOf('#room-exit .sig-motto')
          ]
        };
      }
      default:
        return { title: o.id, pages: [''] };
    }
  }

  function interact() {
    const o = state.eligible;
    if (!o || state.dialog) return;
    openDialogue(contentFor(o));
    App.save();
    updateHud();
  }

  /* ---------- inventory lock (§12) ---------- */
  function updateInventoryLock() {
    if (state.i !== 1) return; // Profile Hall
    const locked = document.getElementById('inventory-lock');
    const table = document.getElementById('inventory-table');
    if (!locked || !table) return;
    if (App.allBannersCollected()) {
      locked.hidden = true;
      table.style.display = 'block';
    } else {
      locked.hidden = false;
      table.style.display = 'none';
      const count = App.bannerCount();
      locked.textContent = 'Locked: collect all banners (' + count + '/6)';
    }
  }

  /* ---------- HUD (§9) ---------- */
  function updateHud() {
    if (state.i < 0 || !dom.hudRoom) return;
    dom.hudRoom.textContent = '◆ ' + ROOMS[state.i].name;
    dom.hudX.textContent = 'Explored ' + App.exploredCount() + '/8';
    dom.hudLoot.textContent = 'Loot ' + App.lootCount() + '/12';
    let local = '';
    switch (ROOM_FIELDS[state.i].local) {
      case 'chests': {
        const n = App.openedIds().filter(id => id.indexOf('analysis-chamber/') === 0).length;
        local = 'Chests ' + n + '/10';
        break;
      }
      case 'research': local = 'Research ' + App.researchCount() + '/3'; break;
      case 'reel': local = 'Reels ' + App.reelCount() + ' · ' + reelClockText(); break;
      case 'quests': local = 'Quests ' + App.questCount() + ' of 7'; break;
      case 'torches': local = 'Torches ' + App.torchCount() + '/5'; break;
      case 'stats': {
        const n = App.openedIds().filter(id => LOOT_CHESTS.indexOf(id) >= 0).length;
        local = 'Rooms ' + App.exploredCount() + '/8 · Chests ' + n + '/12';
        break;
      }
      default: local = '';
    }
    dom.hudLocal.textContent = local;
    dom.hudLocal.hidden = !local;
  }

  /* ---------- read mode / map mode (§19) ---------- */
  function showMap() {
    if (state.i < 0 || !state.section) return;
    if (state.dialog) closeDialogue();
    state.view = 'map';
    state.section.classList.remove('rm-read');
    state.section.classList.add('rm-map');
    if (dom.toggle) dom.toggle.textContent = '▤ Read mode';
    clearHeld();
    App.setView('map');
    if (App.reelFightStop) App.reelFightStop();   // back to map = fight over
    fit();
    updateEligible();
    startLoop();   // read mode stopped the frame loop — restart it or the hero never moves again
    if (dom.stage) dom.stage.focus({ preventScroll: true });
  }
  function showRead() {
    if (state.i < 0 || !state.section) return;
    state.view = 'read';
    state.section.classList.remove('rm-map');
    state.section.classList.add('rm-read');
    clearHeld();
    state.eligible = null;
    if (dom.prompt) dom.prompt.hidden = true;
    App.setView('read');
  }

  /* ---------- render loop ---------- */
  function drawObject(ctx, o) {
    const px = o.obj[0] * 16, py = o.obj[1] * 16;
    if (o.type === 'chest') {
      const open = App.hasChest(o.id);
      const img = imgs.props[open ? 'chest-open' : 'chest-closed'];
      if (img) ctx.drawImage(img, px, py);
      return;
    }
    if (o.type === 'torch') {
      const lit = App.hasTorch(o.id);
      const img = imgs.props[lit ? 'torch-lit' : 'torch-unlit'];
      if (img) ctx.drawImage(img, px, py);
      return;
    }
    if (o.type === 'research') {
      if (App.hasResearch(o.id)) return;              // collected — terrain shows through
      const img = imgs.props.scroll;
      if (img) ctx.drawImage(img, px, py);
      return;
    }
    if (o.type === 'cable') {
      const img = imgs.props[App.getFlag('workaround') ? 'cable-h' : 'cable-v'];
      if (img) ctx.drawImage(img, px, py);
      return;
    }
    if (o.type === 'monster') {
      if (!imgs.monster) return;
      const k = Math.min(5, 1 + App.reelCount());     // integer steps, capped 5× (§15)
      const size = 16 * k;
      ctx.drawImage(imgs.monster, Math.round(px + 8 - size / 2), Math.round(py + 8 - size / 2), size, size);
      return;
    }
    if (o.type === 'rack') {
      const img = imgs.props[o.sprite];
      if (img) ctx.drawImage(img, px, py);
      if (o.dress === 'potion' && App.getQuest(Number(o.say.split('-')[1]) - 1)) {
        const pot = imgs.props.potion;                // equipment: one cell above the rack
        if (pot) ctx.drawImage(pot, px, py - 16);
      }
      return;
    }
    const img = imgs.props[o.sprite];
    if (img) ctx.drawImage(img, px, py);
  }

  const SKULL_MARKS = [[12, 7], [11, 10], [19, 9]];   // cosmetic workaround feedback (§14)

  function drawHero(ctx) {
    const pose = state.moving && !reduced()
      ? ['walk1', 'idle', 'walk2'][Math.floor(state.walkT * POSE_FPS) % 3]
      : 'idle';
    const img = imgs.hero[state.k.dir + '-' + pose] || imgs.hero[state.k.dir + '-idle'];
    if (img) ctx.drawImage(img, Math.round(state.k.x), Math.round(state.k.y));
  }

  function draw() {
    const ctx = dom.ctx;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, WORLD.W, WORLD.H);
    const terrain = imgs.terrains[state.i];
    if (terrain) ctx.drawImage(terrain, 0, 0);
    const f = ROOM_FIELDS[state.i];
    for (const o of f.objects) drawObject(ctx, o);
    if (state.i === 3 && App.getFlag('workaround') && imgs.props.skull) {
      for (const [x, y] of SKULL_MARKS) ctx.drawImage(imgs.props.skull, x * 16, y * 16);
    }
    drawHero(ctx);
    if (state.eligible) {
      ctx.save();
      ctx.strokeStyle = '#E9B872';
      ctx.lineWidth = 1;
      ctx.strokeRect(state.eligible.obj[0] * 16 + 0.5, state.eligible.obj[1] * 16 + 0.5, 15, 15);
      ctx.restore();
    }
  }

  function tick(t) {
    if (state.i < 0 || state.view !== 'map') { state.raf = 0; return; }
    const dt = Math.min(0.05, (t - state.lastT) / 1000 || 0);
    state.lastT = t;
    const dir = activeDir();
    state.moving = false;
    if (dir && !state.dialog && !state.transitioning) move(dir, dt);
    checkTriggers();
    if (state.i < 0) return;
    updateEligible();
    draw();
    if (state.moving && t - state.lastSaveT > 400) { App.save(); state.lastSaveT = t; }
    state.raf = requestAnimationFrame(tick);
  }
  function startLoop() {
    if (state.raf) return;
    state.lastT = performance.now();
    state.raf = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  /* ---------- input (keyboard + touch A + D-pad) ---------- */
  function onKey(e) {
    if (state.i < 0 || isFormTarget(e)) return;
    // native activation owns keys while a widget button has focus
    const ae = document.activeElement;
    if (ae && ae.tagName === 'BUTTON' && state.section && state.section.contains(ae)) return;
    const k = e.key;
    if (k === ' ' || k === 'Spacebar' || k === 'Enter' || k === 'e' || k === 'E') {
      if (state.dialog) { e.preventDefault(); if (!e.repeat) advance(); return; }
      if (state.eligible) { e.preventDefault(); if (!e.repeat) interact(); return; }
      return;
    }
    if (k === 'Escape' && state.dialog) { e.preventDefault(); closeDialogue(); return; }
    const dir = KEYMAP[k];
    if (dir) {
      if (state.view !== 'map') return;      // arrows drive the hero only in Map view (§19)
      e.preventDefault();
      if (!state.dialog) pushDir(dir);
    }
  }
  function onKeyUp(e) {
    if (state.i < 0) return;
    const dir = KEYMAP[e.key];
    if (dir) removeDir(dir);
  }

  function bindWidgetEvents() {
    dom.toggle.addEventListener('click', () => {
      if (state.view === 'map') showRead(); else showMap();
    });
    dom.nextBtn.addEventListener('click', advance);
    dom.closeBtn.addEventListener('click', closeDialogue);
    dom.act.addEventListener('click', () => {
      if (state.dialog) advance();
      else interact();
    });
    dom.dpad.querySelectorAll('.rm-db').forEach(btn => {
      const dir = btn.dataset.dir;
      btn.addEventListener('pointerdown', ev => { ev.preventDefault(); pushDir(dir); });
      btn.addEventListener('pointerup', () => removeDir(dir));
      btn.addEventListener('pointerleave', () => removeDir(dir));
      btn.addEventListener('pointercancel', () => removeDir(dir));
      btn.addEventListener('click', ev => ev.preventDefault());
    });
  }

  function ensureMapBtn() {
    if (!state.section) return;
    const existing = state.section.querySelector('.rm-mapbtn');
    if (existing) { state.mapBtn = existing; return; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rm-mapbtn';
    b.textContent = '◀ Map view';
    b.addEventListener('click', showMap);
    state.section.insertBefore(b, state.section.firstChild);
    state.mapBtn = b;
  }

  /* ---------- lifecycle ---------- */
  function enter(i, restore) {
    stopLoop();
    if (typeof App !== 'undefined' && App.reelFightStop) App.reelFightStop();  // fresh room = fight over
    state.i = i;
    state.section = document.getElementById('room-' + ROOMS[i].id);
    if (!state.section) { state.i = -1; return; }
    if (!state.widget) {
      state.widget = buildWidget();
      bindWidgetEvents();
    }
    if (state.widget.parentNode !== state.section) {
      state.section.insertBefore(state.widget, state.section.firstChild);
    }
    ensureMapBtn();
    state.grid = buildRoomGrid(i);
    const f = ROOM_FIELDS[i];
    const pos = restore || { x: f.spawn[0] * 16, y: f.spawn[1] * 16, dir: f.spawnDir };
    state.k.x = pos.x; state.k.y = pos.y;
    state.k.dir = pos.dir || f.spawnDir;
    state.held.length = 0;
    state.dialog = null;
    dom.dialog.hidden = true;
    state.transitioning = false;
    state.moving = false;
    state.eligible = null;
    state.armedExit = !f.exitCells.some(c => overlapsCell(c));
    state.armedReturn = !f.returnCells.some(c => overlapsCell(c));
    const wantRead = App.getView() === 'read';
    state.view = wantRead ? 'read' : 'map';
    state.section.classList.toggle('rm-map', !wantRead);
    state.section.classList.toggle('rm-read', wantRead);
    // fit() AFTER the view classes: .room-mapview is display:none until the
    // section carries rm-map/rm-read, and a hidden container reports width 0
    // → fit() would fall back to WORLD.W and pin the canvas at 1×.
    fit();
    updateHud();
    updateInventoryLock();
    if (wantRead) {
      state.eligible = null;
      if (dom.prompt) dom.prompt.hidden = true;
      setControlsDisabled(true);
    } else {
      startLoop();
      updateEligible();
      if (dom.stage) dom.stage.focus({ preventScroll: true });
    }
    draw();
  }

  function exit() {
    stopLoop();
    state.held.length = 0;
    state.dialog = null;
    state.eligible = null;
    state.transitioning = false;
    if (dom.dialog) dom.dialog.hidden = true;
    state.i = -1;
  }

  function bindInput() {
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => clearHeld());
    window.addEventListener('resize', () => { if (state.i >= 0 && state.view === 'map') fit(); });
  }

  /* ---------- public API ---------- */
  function snapshot() {
    if (state.i < 0) return null;
    return {
      i: state.i,
      pos: { x: Math.round(state.k.x), y: Math.round(state.k.y), dir: state.k.dir }
    };
  }

  return {
    preload, bindInput, enter, exit, snapshot,
    showMap, showRead,
    fit,
    isReadMode: () => state.i >= 0 && state.view === 'read',
    updateInventoryLock
  };
})();






