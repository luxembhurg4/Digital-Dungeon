'use strict';

/* App — navigation, progress, saving, room interactions. */

const App = (() => {
  const KEY = 'dungeon-of-tabs-save-v1';
  let sv = null;
  let mode = 'room';        // 'room' | 'hallway'
  let currentRoom = 0;
  let entryCtx = null;      // { hall, side, x, y, dir } — how the current room was opened

  /* ---------- save state ---------- */
  function defaultSave() {
    return {
      v: 1,
      explored: [0],
      wellness: [false, false, false, false, false, false, false],
      reel: 0,
      current: { type: 'room', i: 0 },
      hall: null
    };
  }

  function validate(s) {
    if (!s || s.v !== 1) return false;
    if (!Array.isArray(s.explored) || !s.explored.length) return false;
    if (!s.explored.every(i => Number.isInteger(i) && i >= 0 && i < 8)) return false;
    if (!s.explored.includes(0)) return false;
    if (!Array.isArray(s.wellness) || s.wellness.length !== 7) return false;
    if (!Number.isInteger(s.reel) || s.reel < 0) return false;
    if (!s.current) return false;
    if (s.current.type === 'room') {
      if (!Number.isInteger(s.current.i) || !s.explored.includes(s.current.i)) return false;
    } else if (s.current.type === 'hallway') {
      if (!s.hall || !Number.isInteger(s.hall.i) || s.hall.i < 0 || s.hall.i > 6) return false;
    } else return false;
    return true;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      const s = JSON.parse(raw);
      return validate(s) ? s : defaultSave();
    } catch (_) { return defaultSave(); }
  }

  function save() {
    sv.current = mode === 'hallway' ? { type: 'hallway' } : { type: 'room', i: currentRoom };
    if (mode === 'hallway') {
      const snap = Hallway.snapshot();
      if (snap) sv.hall = snap;
    }
    try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (_) {}
  }

  /* ---------- helpers ---------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const isExplored = i => sv.explored.includes(i);
  function markExplored(i) { if (!isExplored(i)) sv.explored.push(i); }

  /* ---------- sidebar ---------- */
  function buildChapterList() {
    const ul = $('#chapter-list');
    ul.innerHTML = '';
    ROOMS.forEach((r, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'chapter-btn';
      btn.dataset.i = i;
      btn.innerHTML = '<span class="ch-num">' + String(i + 1).padStart(2, '0') + '</span> ' + r.name;
      if (!isExplored(i)) {
        btn.disabled = true;
        btn.title = 'Not yet explored — reach this room by walking through the dungeon';
      }
      btn.addEventListener('click', () => openRoom(i, null, { focus: true }));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    highlightChapter();
  }

  function highlightChapter() {
    $$('#chapter-list .chapter-btn').forEach((b, i) => {
      b.classList.toggle('is-current', i === currentRoom && mode === 'room');
      b.classList.toggle('is-open', isExplored(i));
    });
  }

  function updateProgress() {
    $('#explored-count').textContent = sv.explored.length + '/8';
    const seg = $('#progress-segments');
    seg.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('span');
      d.className = 'seg' + (isExplored(i) ? ' on' : '');
      seg.appendChild(d);
    }
  }

  /* ---------- screens ---------- */
  function showOnly(sectionId) {
    $('#screen-hallway').hidden = sectionId !== 'hallway';
    $$('.room').forEach(s => { s.hidden = s.id !== sectionId; });
  }

  function roomSectionId(i) { return 'room-' + ROOMS[i].id; }

  function openRoom(i, entry, opts) {
    opts = opts || {};
    // a room opens only if explored, or via its forward doorway (which unlocks it)
    if (!isExplored(i) && !(entry && entry.side === 'forward')) return;
    if (mode === 'hallway') {
      if (entry) {
        const snap = Hallway.snapshot();
        if (snap) entry = Object.assign({}, entry, snap);
      }
      Hallway.exit();
    }
    mode = 'room';
    currentRoom = i;
    entryCtx = entry || null;
    markExplored(i);

    showOnly(roomSectionId(i));
    renderFooter(i);
    buildChapterList();
    updateProgress();
    $('#crumb-room').textContent = ROOMS[i].name;
    if (i === 7) updateClearedText();

    save();
    if (opts.focus !== false) {
      const h = document.querySelector('#' + roomSectionId(i) + ' h1');
      if (h) h.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  function openRoomByIndex(i, entry) { openRoom(i, entry, { focus: true }); }

  function openHallway(i, restore) {
    mode = 'hallway';
    entryCtx = null;
    showOnly('hallway');
    Hallway.enter(i, restore);
    $('#crumb-room').textContent = 'Hallway 0' + (i + 1);
    highlightChapter();
    save();
    const frame = $('#hallway-canvas-frame');
    if (frame) frame.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* Forward doorway return: just below the destination threshold, facing down.
     Arrival doorway return: back at the spawn. */
  function returnToHallway() {
    if (!entryCtx) return;
    const h = HALLWAYS[entryCtx.hall];
    const pos = entryCtx.side === 'forward'
      ? { x: h.dest[0][0] * 16, y: (h.dest[0][1] + 1) * 16, dir: 'down' }
      : { x: h.spawn[0] * 16, y: h.spawn[1] * 16, dir: 'down' };
    openHallway(entryCtx.hall, pos);
  }

  function continueDungeon() {
    if (currentRoom < 7) openHallway(currentRoom, null);
  }

  /* ---------- room footers ---------- */
  function renderFooter(i) {
    const foot = document.querySelector('.room-footer[data-room="' + i + '"]');
    if (!foot) return;
    foot.innerHTML = '';
    const left = document.createElement('div');
    left.className = 'foot-left';
    const right = document.createElement('div');
    right.className = 'foot-right';

    if (entryCtx) {
      const b = document.createElement('button');
      b.className = 'foot-return';
      b.dataset.act = 'return';
      b.textContent = '← Return to hallway';
      left.appendChild(b);
    } else if (i > 0 && isExplored(i - 1)) {
      const b = document.createElement('button');
      b.className = 'foot-return';
      b.dataset.act = 'goto';
      b.dataset.i = i - 1;
      b.textContent = '← ' + ROOMS[i - 1].name;
      left.appendChild(b);
    }

    if (i < 7) {
      const b = document.createElement('button');
      b.className = 'btn btn-gold';
      b.dataset.act = 'continue';
      b.innerHTML = (i === 0 ? 'Enter the dungeon' : 'Continue through the dungeon') + ' <span class="arr">→</span>';
      right.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.className = 'btn btn-dark';
      b.dataset.act = 'goto';
      b.dataset.i = 0;
      b.innerHTML = 'Back to the gate <span class="arr">→</span>';
      right.appendChild(b);
    }
    foot.appendChild(left);
    foot.appendChild(right);
  }

  /* ---------- room interactions ---------- */
  function updateWellness() {
    const n = sv.wellness.filter(Boolean).length;
    $('#wellness-count').textContent = n + ' of 7';
    const seg = $('#wellness-segments');
    seg.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = document.createElement('span');
      d.className = 'seg' + (sv.wellness[i] ? ' on' : '');
      seg.appendChild(d);
    }
    $('#wellness-done').hidden = n < 7;
    $$('.quest-check').forEach(cb => { cb.checked = sv.wellness[Number(cb.dataset.i)]; });
  }

  function updateClearedText() {
    const n = sv.wellness.filter(Boolean).length;
    const el = $('#cleared-text');
    if (el) el.textContent = '8 of 8 rooms explored. The journal is complete; the 7-day wellness plan is still at ' +
      n + ' of 7 quests done.';
  }

  function renderReel() {
    const k = sv.reel;
    const total = 21 * 60 + 17 * k;          // start 9:00 PM
    const mins = total % (24 * 60);
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    $('#reel-time').textContent = h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    $('#reel-count').textContent = k;
    $('#reel-lost').hidden = k < 6;
  }

  function updateQaCounter() {
    const all = $$('.qa');
    const open = all.filter(d => d.open).length;
    $('#qa-counter').textContent = open + ' / 10 OPEN';
  }

  /* ---------- events ---------- */
  function bindEvents() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'continue') continueDungeon();
      else if (act === 'return') returnToHallway();
      else if (act === 'goto') openRoom(Number(t.dataset.i), null, { focus: true });
    });

    $$('.quest-check').forEach(cb => {
      cb.addEventListener('change', () => {
        sv.wellness[Number(cb.dataset.i)] = cb.checked;
        updateWellness();
        if (currentRoom === 7) updateClearedText();
        save();
      });
    });

    $('#reel-swipe').addEventListener('click', () => { showReel(feedIdx + 1, true); });
    $('#reel-escape').addEventListener('click', () => { stopAuto(); sv.reel = 0; renderReel(); save(); showReel(0, false); });
    let feedIdx = 0, autoOn = true, autoTimer = null, soundOn = false;
    const FEED_IDS = ['6YL9FxT6eHw','UFe2L7LO6uc','QHM-RFn6e7Q','6JLCyiToRdo','lKCUCJtQhWA','vgrwRIkH7iM','lDvQBE8_oO8'];
    function reelSrc(id, play) { return 'https://www.youtube.com/embed/' + id + '?rel=0&playsinline=1' + (play ? '&autoplay=1' + (soundOn ? '' : '&mute=1') : ''); }
    function pauseReel(card) { const f = card.querySelector('iframe'); if (f) { f.src = reelSrc(f.dataset.short, false); card.dataset.playing = ''; } }
    function showReel(i, countIt) {
      const cards = $$('.reel-card');
      if (!cards.length) return;
      feedIdx = ((i % cards.length) + cards.length) % cards.length;
      cards.forEach((c, k) => {
        const f = c.querySelector('iframe');
        c.hidden = k !== feedIdx;
        c.classList.toggle('is-active', k === feedIdx);
        if (!f) return;
        if (k === feedIdx) { f.src = reelSrc(f.dataset.short, true); c.dataset.playing = '1'; }
        else pauseReel(c);
      });
      const now = $('#feed-now');
      if (now) now.textContent = 'NOW PLAYING · REEL ' + (feedIdx + 1) + ' OF ' + cards.length + (autoOn ? ' · AUTOPLAY ON' : ' · AUTOPLAY OFF');
      if (countIt) { sv.reel += 1; renderReel(); save(); }
      restartAuto();
    }
    function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
    function reelVisible() { const s = document.getElementById('room-reel-trap'); return !!(s && !s.hidden); }
    function restartAuto() {
      stopAuto();
      if (!autoOn) return;
      autoTimer = setInterval(() => { if (reelVisible()) showReel(feedIdx + 1, true); }, 20000);
    }
    function setAuto(on) {
      autoOn = on;
      const b = document.querySelector('.reel-auto');
      if (b) { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? '⏸ Pause autoplay' : '▶ Resume autoplay'; }
      const feed = document.querySelector('.monster-feed');
      if (feed) feed.dataset.autoplay = on ? 'on' : 'off';
      const bar = document.querySelector('.reel-bar');
      if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
      const now = $('#feed-now');
      if (now) { const cards = $$('.reel-card').length || 7; now.textContent = 'NOW PLAYING · REEL ' + (feedIdx + 1) + ' OF ' + cards + (on ? ' · AUTOPLAY ON' : ' · AUTOPLAY OFF'); }
      if (on) restartAuto(); else stopAuto();
    }
    document.querySelector('.reel-sound')?.addEventListener('click', (e) => {
      soundOn = !soundOn;
      const b = e.currentTarget;
      b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      b.textContent = soundOn ? '🔊 Sound on' : '🔇 Tap for sound';
      showReel(feedIdx, false);
    });
    document.querySelector('.reel-auto')?.addEventListener('click', () => setAuto(!autoOn));
    $$('.reel-next').forEach(b => b.addEventListener('click', () => showReel(feedIdx + 1, true)));
    $$('.reel-prev').forEach(b => b.addEventListener('click', () => { stopAuto(); showReel(feedIdx - 1, false); if (autoOn) restartAuto(); }));
    // First paint: load reel 1 in autoplay mode (muted, per browser policy — tap video for sound).
    showReel(0, false); setAuto(true);
    $$('.reel-watch').forEach(b => b.addEventListener('click', () => {
      const card = b.closest('.reel-card');
      card.dataset.playing = '1';
      sv.reel += 1; renderReel(); save();
      b.innerHTML = 'Counted ✓ · Swipe for more <span class="arr">→</span>';
      setTimeout(() => { b.innerHTML = 'Count this Reel <span class="arr">→</span>'; }, 1500);
    }));

    $$('.qa').forEach(d => d.addEventListener('toggle', updateQaCounter));

    $('#reset-btn').addEventListener('click', () => {
      if (!window.confirm('Reset all progress? Explored rooms, wellness ticks and the Reel simulation will be cleared.')) return;
      try { localStorage.removeItem(KEY); } catch (_) {}
      sv = defaultSave();
      entryCtx = null;
      updateWellness(); renderReel(); updateQaCounter();
      openRoom(0, null, { focus: true });
    });

    $('#retry-btn').addEventListener('click', () => bootAssets());
    window.addEventListener('resize', () => Hallway.fit());
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  }

  /* ---------- loading ---------- */
  function bootAssets() {
    const overlay = $('#loading-overlay');
    overlay.classList.remove('is-error');
    $('#retry-btn').hidden = true;
    overlay.hidden = false;
    Hallway.preload()
      .then(() => { overlay.hidden = true; restore(); })
      .catch(err => {
        overlay.classList.add('is-error');
        $('.loading-title').textContent = 'SOME ASSETS FAILED TO LOAD';
        $('.loading-text').textContent = 'Could not load ' + (err && err.message ? err.message : 'assets') + '.';
        $('#retry-btn').hidden = false;
      });
  }

  function restore() {
    if (sv.current.type === 'hallway' && sv.hall) {
      openHallway(sv.hall.i, sv.hall);
    } else {
      openRoom(sv.current.i, null, { focus: false });
    }
  }

  /* ---------- init ---------- */
  function init() {
    sv = load();
    buildChapterList();
    updateProgress();
    updateWellness();
    renderReel();
    updateQaCounter();
    renderFooter(0);
    bindEvents();
    Hallway.bindInput();
    bootAssets();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openRoomByIndex, save, init };
})();


