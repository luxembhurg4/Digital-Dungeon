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
      hall: null,
      banners: [],
      /* rooms-engine fields (compatible migration — old saves stay valid) */
      rooms: {},            // per-room hero position { x, y, dir }
      opened: [],           // opened reward-chest ids
      research: [],         // router-quest research scroll ids
      torches: [],          // vault torch ids
      flags: {},            // misc room flags (workaround, fix, …)
      view: 'map'           // 'map' | 'read'
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

  /* Fill newer save fields on older saves without erasing progress (§ persistence). */
  function migrate(s) {
    if (!s.rooms || typeof s.rooms !== 'object') s.rooms = {};
    if (!Array.isArray(s.opened)) s.opened = [];
    if (!Array.isArray(s.research)) s.research = [];
    if (!Array.isArray(s.torches)) s.torches = [];
    if (!s.flags || typeof s.flags !== 'object') s.flags = {};
    if (typeof s.view !== 'string') s.view = 'map';
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      const s = JSON.parse(raw);
      return validate(s) ? migrate(s) : defaultSave();
    } catch (_) { return defaultSave(); }
  }

  function save() {
    sv.current = mode === 'hallway' ? { type: 'hallway' } : { type: 'room', i: currentRoom };
    if (mode === 'hallway') {
      const snap = Hallway.snapshot();
      if (snap) sv.hall = snap;
    }
    if (typeof Rooms !== 'undefined' && Rooms.snapshot) {
      const rs = Rooms.snapshot();
      if (rs) { sv.rooms = sv.rooms || {}; sv.rooms[rs.i] = rs.pos; }
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

    Rooms.enter(i, (sv.rooms && sv.rooms[i]) || null);
    save();
    if (opts.focus !== false) {
      const h = document.querySelector('#' + roomSectionId(i) + ' h1');
      if (h) h.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  function openRoomByIndex(i, entry) { openRoom(i, entry, { focus: true }); }

  function openHallway(i, restore) {
    Rooms.exit();
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
    /* Read-mode "next" restores this room's Map view instead of bypassing
       the room's exit threshold (master plan §19). */
    if (mode === 'room') { Rooms.showMap(); return; }
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

  /* ---------- Reel Trap feed state (fight-gated; whole-reel playback) ---------- */
  let feedIdx = 0, autoOn = false, soundOn = true, fightOn = false;
  let progTimer = null;
  let ytState = 0;               // 0 idle · 1 loading · 2 ready · 3 failed
  let ytWaiters = [];
  const players = [];            // YT.Player per reel index (built when API ready)
  const FEED_IDS = ['6YL9FxT6eHw', 'UFe2L7LO6uc', 'QHM-RFn6e7Q', '6JLCyiToRdo',
    'lKCUCJtQhWA', 'vgrwRIkH7iM', 'lDvQBE8_oO8'];

  function reelSrc(id, play) {
    return 'https://www.youtube.com/embed/' + id + '?rel=0&playsinline=1' +
      (play ? '&autoplay=1' : '') + (soundOn ? '' : '&mute=1');
  }
  function activeFrame() {
    const c = $$('.reel-card')[feedIdx];
    return c ? c.querySelector('iframe') : null;
  }
  function loadYT() {
    if (ytState === 2) return Promise.resolve(true);
    if (ytState === 3) return Promise.resolve(false);
    if (ytState === 1) return new Promise(r => ytWaiters.push(r));
    ytState = 1;
    return new Promise(resolve => {
      ytWaiters.push(resolve);
      const finish = ok => {
        if (ytState !== 1) return;
        ytState = ok ? 2 : 3;
        if (ok) buildPlayers();
        ytWaiters.splice(0).forEach(fn => fn(ok));
      };
      const t = setTimeout(() => finish(false), 10000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(t); finish(true); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { clearTimeout(t); finish(false); };
      document.head.appendChild(s);
    });
  }
  function buildPlayers() {
    $$('.reel-card').forEach((card, k) => {
      if (players[k]) return;
      const frame = card.querySelector('.reel-frame');
      if (!frame) return;
      const old = frame.querySelector('iframe');
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;inset:0;';
      frame.replaceChild(host, old);
      players[k] = new YT.Player(host, {
        videoId: FEED_IDS[k],
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1, enablejsapi: 1 },
        events: {
          onReady: e => {
            if (soundOn) e.target.unMute(); else e.target.mute();
            if (k === feedIdx && fightOn && autoOn) { e.target.playVideo(); startProgress(); }
          },
          onStateChange: e => {
            if (!window.YT) return;
            if (e.data === YT.PlayerState.PLAYING) {
              if (k === feedIdx && fightOn) startProgress();
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              stopProgress();
            }
            // whole reel finished → only now advance (never cut mid-video)
            if (e.data === YT.PlayerState.ENDED && k === feedIdx && fightOn && autoOn) {
              showReel(feedIdx + 1, true);
            }
          }
        }
      });
    });
  }

  function startProgress() {
    stopProgress();
    progTimer = setInterval(() => {
      const p = players[feedIdx];
      const bar = document.querySelector('.reel-bar');
      if (!bar || !p || !p.getDuration) return;
      const d = p.getDuration(), t = p.getCurrentTime();
      if (d > 0) bar.style.width = Math.min(100, (t / d) * 100) + '%';
    }, 250);
  }
  function stopProgress() {
    if (progTimer) { clearInterval(progTimer); progTimer = null; }
  }
  function resetProgress() {
    stopProgress();
    const bar = document.querySelector('.reel-bar');
    if (bar) bar.style.width = '0%';
  }
  function playActive() {
    const p = players[feedIdx];
    if (p && p.playVideo) {
      if (soundOn) p.unMute(); else p.mute();
      try { p.playVideo(); } catch (_) {}
      startProgress();
      return;
    }
    const f = activeFrame();                       // API unavailable → plain iframe
    if (f && fightOn && autoOn) f.src = reelSrc(f.dataset.short, true);
  }
  function pauseAll() {
    players.forEach(p => { if (p && p.pauseVideo) { try { p.pauseVideo(); } catch (_) {} } });
    const f = activeFrame();
    if (f && ytState === 3) f.src = reelSrc(f.dataset.short, false);
    stopProgress();
  }
  function updateFeedHead() {
    const now = $('#feed-now');
    if (!now) return;
    const total = $$('.reel-card').length || 7;
    now.textContent = fightOn
      ? 'NOW PLAYING · REEL ' + (feedIdx + 1) + ' OF ' + total + (autoOn ? ' · AUTOPLAY ON' : ' · PAUSED')
      : 'FEED STANDBY · REEL ' + (feedIdx + 1) + ' OF ' + total + ' · TALK TO THE REEL MONSTER';
  }
  function setAuto(on) {
    autoOn = on;
    const b = document.querySelector('.reel-auto');
    if (b) {
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? '⏸ Pause autoplay' : '▶ Resume autoplay';
    }
    const feed = document.querySelector('.monster-feed');
    if (feed) feed.dataset.autoplay = on ? 'on' : 'off';
    updateFeedHead();
    if (on && fightOn) playActive();
    else pauseAll();
  }
  function engageFight() {
    fightOn = true;
    setAuto(true);
    loadYT().then(ok => {
      if (!fightOn) return;
      if (ok) playActive();
      else { const f = activeFrame(); if (f && autoOn) f.src = reelSrc(f.dataset.short, true); }
      updateFeedHead();
    });
  }
  function reelFightStart() { engageFight(); }
  function reelFightStop() {
    if (!fightOn && !autoOn) { stopProgress(); return; }
    fightOn = false;
    setAuto(false);
    pauseAll();
    resetProgress();
  }
  function showReel(i, countIt) {
    const cards = $$('.reel-card');
    if (!cards.length) return;
    feedIdx = ((i % cards.length) + cards.length) % cards.length;
    cards.forEach((c, k) => {
      c.hidden = k !== feedIdx;
      c.classList.toggle('is-active', k === feedIdx);
      if (k !== feedIdx) {
        const p = players[k];
        if (p && p.pauseVideo) { try { p.pauseVideo(); } catch (_) {} }
      }
    });
    resetProgress();
    if (ytState === 2) {
      if (fightOn && autoOn) playActive();
      else { const p = players[feedIdx]; if (p && p.pauseVideo) { try { p.pauseVideo(); } catch (_) {} } }
    } else if (ytState === 3) {
      const f = activeFrame();
      if (f) f.src = reelSrc(f.dataset.short, fightOn && autoOn);
    }
    updateFeedHead();
    if (countIt) { sv.reel += 1; renderReel(); save(); }
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

    $('#reel-swipe').addEventListener('click', () => { engageFight(); showReel(feedIdx + 1, true); });
    $('#reel-escape').addEventListener('click', (e) => {
      // Escape stops the fight, resets the sim, and returns to Map view so the
      // hero can move again (read mode ignores movement keys by design).
      reelFightStop();
      sv.reel = 0; renderReel(); save();
      showReel(0, false);
      if (typeof Rooms !== 'undefined' && Rooms.showMap) Rooms.showMap();
      if (e && e.currentTarget) e.currentTarget.blur();
    });
    document.querySelector('.reel-sound')?.addEventListener('click', (e) => {
      soundOn = !soundOn;
      const b = e.currentTarget;
      b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      b.textContent = soundOn ? '🔊 Sound on' : '🔇 Tap for sound';
      const p = players[feedIdx];
      if (p && p.mute) {
        if (soundOn) p.unMute(); else p.mute();
        if (fightOn && autoOn && p.playVideo) p.playVideo();
      } else {
        const f = activeFrame();
        if (f) f.src = reelSrc(f.dataset.short, fightOn && autoOn);
      }
    });
    document.querySelector('.reel-auto')?.addEventListener('click', () => {
      if (autoOn) setAuto(false); else engageFight();
    });
    $$('.reel-next').forEach(b => b.addEventListener('click', () => { engageFight(); showReel(feedIdx + 1, true); }));
    $$('.reel-prev').forEach(b => b.addEventListener('click', () => { engageFight(); showReel(feedIdx - 1, false); }));
    // First paint: reel 1 in standby — autoplay only starts when the fight
    // (Reel Monster encounter) is triggered.
    showReel(0, false);
    $$('.reel-watch').forEach(b => b.addEventListener('click', () => {
      engageFight();
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
    Promise.all([Hallway.preload(), Rooms.preload()])
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
    Hallway.bindBackConfirm();
    Rooms.bindInput();
    bootAssets();
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ---------- rooms-engine API (used by js/rooms.js) ---------- */
  const exploredCount = () => sv.explored.length;
  const lootCount = () => sv.opened.filter(id => LOOT_CHESTS.indexOf(id) >= 0).length;
  const openedIds = () => sv.opened.slice();
  function markChest(id) {
    if (sv.opened.indexOf(id) >= 0) return false;
    sv.opened.push(id);
    return true;
  }
  const hasChest = id => sv.opened.indexOf(id) >= 0;
  function addResearch(id) {
    if (sv.research.indexOf(id) >= 0) return false;
    sv.research.push(id);
    return true;
  }
  const hasResearch = id => sv.research.indexOf(id) >= 0;
  const researchCount = () => sv.research.length;
  const markBanner = id => {
    if (sv.banners && sv.banners.indexOf(id) >= 0) return false;
    sv.banners = sv.banners || [];
    sv.banners.push(id);
    if (typeof Rooms !== 'undefined' && Rooms.updateInventoryLock) Rooms.updateInventoryLock();
    return true;
  };
  const hasBanner = id => !!sv.banners && sv.banners.indexOf(id) >= 0;
  const bannerCount = () => (sv.banners ? sv.banners.length : 0);
  const allBannersCollected = () => {
    // Locked until every Profile Hall app banner has been read (§12).
    const required = ['app-fblite', 'app-vscode', 'app-youtube', 'app-messenger', 'app-ai', 'app-firefox'];
    return required.every(id => !!sv.banners && sv.banners.indexOf(id) >= 0);
  };
  function lightTorch(id) {
    if (sv.torches.indexOf(id) >= 0) return false;
    sv.torches.push(id);
    return true;
  }
  const hasTorch = id => sv.torches.indexOf(id) >= 0;
  const torchCount = () => sv.torches.length;
  const setFlag = (k, v) => { sv.flags[k] = v; };
  const getFlag = k => !!sv.flags[k];
  function setQuest(i, on) {
    sv.wellness[i] = !!on;
    updateWellness();
    if (currentRoom === 7) updateClearedText();
    save();
  }
  const getQuest = i => !!sv.wellness[i];
  const questCount = () => sv.wellness.filter(Boolean).length;
  const reelCount = () => sv.reel;
  const getView = () => sv.view;
  function setView(v) {
    if (sv.view !== v) { sv.view = v; save(); }
  }
  const enterHallway = (i, restore) => openHallway(i, restore);

  return {
    openRoomByIndex, save, init,
    exploredCount, lootCount, openedIds, markChest, hasChest,
    addResearch, hasResearch, researchCount,
    lightTorch, hasTorch, torchCount,
    setFlag, getFlag, setQuest, getQuest, questCount,
    reelCount, getView, setView, enterHallway, reelFightStart, reelFightStop,
    markBanner, hasBanner, bannerCount, allBannersCollected
  };
})();


