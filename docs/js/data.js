'use strict';

/* ============================================================
 * Dungeon of Tabs — game data
 * All coordinates are tile coordinates from the master plan.
 * ============================================================ */

const WORLD = { TILE: 16, COLS: 24, ROWS: 18, W: 384, H: 288 };
const SPEED = 64;            // world px per second (master plan suggestion)
const POSE_FPS = 8;          // walk pose changes per second

const ROOMS = [
  { id: 'gate',               name: 'Gate',               eyebrow: 'ROOM 01 / 08 · MEET THE ADVENTURER' },
  { id: 'profile-hall',       name: 'Profile Hall',       eyebrow: 'ROOM 02 / 08 · MY DIGITAL MEDIA PROFILE' },
  { id: 'analysis-chamber',   name: 'Analysis Chamber',   eyebrow: 'ROOM 03 / 08 · TEN QUESTIONS, TEN ANSWERS' },
  { id: 'router-quest',       name: 'Router Quest',       eyebrow: 'ROOM 04 / 08 · WHEN TECH SCARED ME' },
  { id: 'reel-trap',          name: 'Reel Trap',          eyebrow: 'ROOM 05 / 08 · MY REAL WEAKNESS' },
  { id: 'plan-armory',        name: 'Plan Armory',        eyebrow: 'ROOM 06 / 08 · 7-DAY DIGITAL WELLNESS PLAN' },
  { id: 'infographic-vault',  name: 'Infographic Vault',  eyebrow: 'ROOM 07 / 08 · MY HEALTHIER DIGITAL LIFE' },
  { id: 'exit',               name: 'Exit',               eyebrow: 'ROOM 08 / 08 · MY ONE CHANGE' }
];

/* Hallway index i connects ROOMS[i] -> ROOMS[i+1] */
const HALLWAYS = [
  {
    n: 1, title: 'The Arrival Hall',
    spawn: [11, 14],
    dest: [[11, 2], [12, 2]],
    arrival: [[11, 15], [12, 15]],
    walkable: [[8, 2, 15, 7], [10, 7, 13, 12], [5, 12, 18, 15]],
    blockedRects: [],
    props: [[8, 3], [15, 3], [6, 13], [17, 13]],
    caption: 'Stone, banners and warm torchlight introduce the journey.',
    destSide: 'top', destRoom: 'profile-hall'
  },
  {
    n: 2, title: 'The Archive Gallery',
    spawn: [5, 13],
    dest: [[18, 3], [19, 3]],
    arrival: [[5, 14], [6, 14]],
    walkable: [[3, 10, 8, 15], [7, 10, 19, 13], [16, 3, 20, 13]],
    blockedRects: [],
    props: [[3, 10], [4, 10], [10, 13], [11, 13], [16, 4], [20, 7]],
    caption: 'An L-shaped archive gallery lined with shelves and scrolls.',
    destSide: 'top', destRoom: 'analysis-chamber'
  },
  {
    n: 3, title: 'The Workshop Route',
    spawn: [5, 4],
    dest: [[18, 3], [19, 3]],
    arrival: [[5, 5], [6, 5]],
    walkable: [[3, 3, 7, 14], [3, 11, 20, 14], [16, 3, 20, 14]],
    blockedRects: [],
    props: [[3, 5], [20, 8], [7, 9], [16, 9]],
    caption: 'A U-shaped workshop route around a solid central core.',
    destSide: 'top', destRoom: 'router-quest'
  },
  {
    n: 4, title: 'The Monster Zigzag',
    spawn: [5, 14],
    dest: [[18, 2], [19, 2]],
    arrival: [[5, 15], [6, 15]],
    walkable: [[3, 11, 8, 15], [6, 10, 15, 12], [12, 6, 15, 12], [12, 4, 20, 7], [17, 2, 20, 7]],
    blockedRects: [],
    props: [[3, 12], [8, 15], [12, 7], [20, 6], [17, 4]],
    caption: 'A stepped zigzag with green banners, skulls, and the monster.',
    destSide: 'top', destRoom: 'reel-trap'
  },
  {
    n: 5, title: 'The Sanctuary Cross',
    spawn: [11, 14],
    dest: [[11, 3], [12, 3]],
    arrival: [[11, 15], [12, 15]],
    walkable: [[4, 7, 19, 10], [10, 3, 13, 14], [7, 11, 16, 15]],
    blockedRects: [],
    props: [[4, 7], [4, 9], [19, 7], [19, 9], [7, 12], [16, 12]],
    caption: 'A cross-shaped sanctuary with equipment alcoves and recovery supplies.',
    destSide: 'top', destRoom: 'plan-armory'
  },
  {
    n: 6, title: 'The Ring Archive',
    spawn: [6, 12],
    dest: [[11, 1], [12, 1]],
    arrival: [[6, 13], [7, 13]],
    walkable: [[4, 3, 19, 14], [9, 1, 14, 4]],
    blockedRects: [[8, 7, 15, 10]],
    props: [[4, 5], [19, 5], [5, 3], [18, 13], [17, 3], [10, 14]],
    caption: 'A ring-shaped archive around a solid island, with two approaches.',
    destSide: 'top', destRoom: 'infographic-vault'
  },
  {
    n: 7, title: 'The Final Passage',
    spawn: [11, 14],
    dest: [[11, 3], [12, 3]],
    arrival: [[11, 15], [12, 15]],
    walkable: [[5, 3, 18, 7], [10, 7, 13, 15], [7, 12, 16, 15]],
    blockedRects: [],
    props: [[5, 4], [18, 4], [7, 13], [16, 13], [9, 4], [14, 4]],
    caption: 'A processional passage leading to a broad final dais.',
    destSide: 'top', destRoom: 'exit'
  }
];

/* Build the collision grid for one hallway: true = walkable */
function buildGrid(h) {
  const grid = [];
  for (let r = 0; r < WORLD.ROWS; r++) grid.push(new Array(WORLD.COLS).fill(false));
  const open = (x1, y1, x2, y2, val) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
      if (y >= 0 && y < WORLD.ROWS && x >= 0 && x < WORLD.COLS) grid[y][x] = val;
    }
  };
  for (const [x1, y1, x2, y2] of h.walkable) open(x1, y1, x2, y2, true);
  for (const [x1, y1, x2, y2] of h.blockedRects) open(x1, y1, x2, y2, false);
  for (const [x, y] of h.props) if (grid[y] && y < WORLD.ROWS) grid[y][x] = false;
  return grid;
}

/* Wellness actions (master plan section 8) */
const WELLNESS = [
  'Turn off non-essential notifications (keep 3 apps)',
  'Set a 1-hour limit on FB Lite and Reels',
  'Complete one 90-minute study block with the phone elsewhere',
  'Verify two claims or AI answers with two reliable sources',
  'Spend one offline hour with friends or family',
  'Avoid screens for 30 minutes before bed',
  'Review Screen Time against Day 1'
];

/* ============================================================
 * Room collision masks — master plan section 20.
 * Every cell starts blocked; only the listed spans open.
 * Spans are inclusive "a" or "a-b", comma separated, per row.
 * Solid prop cells are already excluded by the spans.
 * ============================================================ */
const ROOM_COLLISION = [
  /* 0 Gate */
  ['', '11-12', '11-12', '9-14', '9-10,12-14', '9-14', '9-14',
    '6-17', '6-17', '6-17', '9-14', '9-14', '9-14', '9-14', '9-14', '9-14', '10-11', ''],
  /* 1 Profile Hall */
  ['', '19-20', '19-20', '3-5,10-12,17-19', '3,5,10,12,17,19',
    '3-5,10-12,17-19', '3-5,10-12,17-19', '3-5,10-12,17-19', '3-10,12-20', '3-20',
    '3,5,10,12,17,19', '3-5,10-12,17-19', '4-5,10-12', '4-5,10-12', '4-5', '4-5', '4-5', ''],
  /* 2 Analysis Chamber */
  ['', '19-20', '2-7,9-14,16-21', '2-3,5-7,9-10,12-14,16-17,19-21',
    '2,4-5,7,9,11-12,14,16,18-19,21', '2-7,9-14,16-21',
    '2,4-5,7,9,11-14,16,18-21', '2-21', '5-6,12-13,19-20',
    '2-21', '2-21', '2-21', '2-21', '2-21', '2-21', '2-21', '4-5', ''],
  /* 3 Router Quest */
  ['', '19-20', '19-20', '17-20', '3-10,17,19-20', '3-5,7-10,17-20',
    '3-10,17-20', '3-13,19-20', '3-13,19-20', '4-5,10-21',
    '4-5,10-21', '4-5,10-21', '4-5,13-21', '4-5', '4-5', '4-5', '4-5', ''],
  /* 4 Reel Trap */
  ['', '19-20', '19-20', '19-20', '6-20', '6-17,19-20', '6-10,12-20',
    '6-17', '6-17', '6-17', '6-17', '4-17', '4-7', '4-7', '4-7', '4-7', '4-5', ''],
  /* 5 Plan Armory */
  ['', '19-20', '19-20', '3-5,8-10,13-15,18-20', '3,5,8,10,13,15,18,20',
    '3-5,8-10,13-15,18-20', '3-5,8-10,13-15,18-20', '3-20', '3-20', '6-7,12-13,18-19',
    '5,7-11,13-17,19', '5-19', '4-19', '4-6', '4-6', '4-6', '4-5', ''],
  /* 6 Infographic Vault */
  ['', '19-20', '19-20', '19-20', '3,5-7,9-11,13-15,17-19,21', '3-21', '3-21',
    '4-5,10-13,19-20', '4-5,10-13,19-20', '3-5,10-13,19-21', '3,5,10-13,19,21',
    '3-21', '3-21', '4-5', '4-5', '4-5', '4-5', ''],
  /* 7 Exit */
  ['', '11-12', '11-12', '11-12', '8-16', '8-16', '8-11,14-16',
    '8-16', '8-16', '8-16', '8-16', '8-9', '8-9', '4-9', '4-9', '4-9', '4-5', '']
];

/* Build the walkable grid for one room: true = walkable */
function buildRoomGrid(roomIndex) {
  const spans = ROOM_COLLISION[roomIndex] || [];
  const grid = [];
  for (let r = 0; r < WORLD.ROWS; r++) {
    const row = new Array(WORLD.COLS).fill(false);
    const spec = spans[r];
    if (spec) {
      for (const part of spec.split(',')) {
        const bits = part.trim().split('-');
        const a = parseInt(bits[0], 10);
        const b = bits.length > 1 ? parseInt(bits[1], 10) : a;
        for (let c = a; c <= b; c++) if (c >= 0 && c < WORLD.COLS) row[c] = true;
      }
    }
    grid.push(row);
  }
  return grid;
}
/* ============================================================
 * Room fields — master plan §10 spawns/exit thresholds and
 * §11–18 interactive objects. Zero-based tile coordinates.
 * obj = solid object cell · at = interaction cell (face the object).
 * ============================================================ */
const ROOM_FIELDS = [
  { // 0 Gate — §11
    spawn: [10, 14], spawnDir: 'up',
    exitCells: [[11, 2], [12, 2]],
    returnCells: [],
    local: null,
    objects: [
      { id: 'gate-banner', type: 'banner', obj: [11, 4], at: [11, 5], sprite: 'banner-gold', say: 'gate-profile' }
    ],
    terrain: 'assets/rooms/gate/map-terrain.png',
    readMode: 'assets/rooms/gate/read-mode.png'
  },
  { // 1 Profile Hall — §12
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[19, 2], [20, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: null,
    objects: [
      { id: 'app-fblite', type: 'app', obj: [4, 4], at: [4, 5], sprite: 'banner-gold', say: 'FB Lite' },
      { id: 'app-vscode', type: 'app', obj: [11, 4], at: [11, 5], sprite: 'banner-gold', say: 'VS Code' },
      { id: 'app-youtube', type: 'app', obj: [18, 4], at: [18, 5], sprite: 'banner-gold', say: 'YouTube' },
      { id: 'app-messenger', type: 'app', obj: [4, 10], at: [4, 11], sprite: 'banner-gold', say: 'Messenger' },
      { id: 'app-ai', type: 'app', obj: [11, 10], at: [11, 11], sprite: 'banner-gold', say: 'AI' },
      { id: 'app-firefox', type: 'app', obj: [18, 10], at: [18, 11], sprite: 'banner-gold', say: 'Firefox' },
      { id: 'profile-shelf', type: 'shelf', obj: [11, 8], at: [11, 9], sprite: 'archive-shelf', say: 'profile-inventory' },
      { id: 'profile-measures', type: 'scroll', obj: [11, 12], at: [11, 13], sprite: 'scroll', say: 'profile-measures' }
    ],
    terrain: 'assets/rooms/profile-hall/map-terrain.png',
    readMode: 'assets/rooms/profile-hall/read-mode.png'
  },
  { // 2 Analysis Chamber — §13 (reference room)
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[19, 2], [20, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: 'chests',
    objects: [
      { id: 'analysis-chamber/chest-01', type: 'chest', obj: [3, 4], at: [3, 5], sprite: 'chest', say: 'qa-0' },
      { id: 'analysis-chamber/chest-02', type: 'chest', obj: [6, 4], at: [6, 5], sprite: 'chest', say: 'qa-1' },
      { id: 'analysis-chamber/chest-03', type: 'chest', obj: [3, 6], at: [3, 7], sprite: 'chest', say: 'qa-2' },
      { id: 'analysis-chamber/chest-04', type: 'chest', obj: [6, 6], at: [6, 7], sprite: 'chest', say: 'qa-3' },
      { id: 'analysis-chamber/chest-05', type: 'chest', obj: [10, 4], at: [10, 5], sprite: 'chest', say: 'qa-4' },
      { id: 'analysis-chamber/chest-06', type: 'chest', obj: [13, 4], at: [13, 5], sprite: 'chest', say: 'qa-5' },
      { id: 'analysis-chamber/chest-07', type: 'chest', obj: [10, 6], at: [10, 7], sprite: 'chest', say: 'qa-6' },
      { id: 'analysis-chamber/chest-08', type: 'chest', obj: [17, 4], at: [17, 5], sprite: 'chest', say: 'qa-7' },
      { id: 'analysis-chamber/chest-09', type: 'chest', obj: [20, 4], at: [20, 5], sprite: 'chest', say: 'qa-8' },
      { id: 'analysis-chamber/chest-10', type: 'chest', obj: [17, 6], at: [17, 7], sprite: 'chest', say: 'qa-9' }
    ],
    terrain: 'assets/rooms/analysis-chamber/map-terrain.png',
    readMode: 'assets/rooms/analysis-chamber/read-mode.png'
  },  { // 3 Router Quest — §14
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[19, 2], [20, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: 'research',
    objects: [
      { id: 'router-intro', type: 'banner', obj: [6, 12], at: [5, 12], sprite: 'banner-gold', say: 'router-intro' },
      { id: 'router-unit', type: 'router', obj: [6, 5], at: [6, 6], sprite: 'router', say: 'router-refusal' },
      { id: 'router-cable', type: 'cable', obj: [8, 5], at: [8, 6], sprite: 'cable', say: 'router-workaround' },
      { id: 'research-youtube', type: 'research', obj: [14, 10], at: [14, 11], sprite: 'scroll', say: 'research' },
      { id: 'research-forums', type: 'research', obj: [17, 10], at: [17, 11], sprite: 'scroll', say: 'research' },
      { id: 'research-ai', type: 'research', obj: [20, 10], at: [20, 11], sprite: 'scroll', say: 'research' },
      { id: 'router-quest/chest-01', type: 'chest', obj: [18, 4], at: [18, 5], sprite: 'chest', say: 'router-lesson' }
    ],
    terrain: 'assets/rooms/router-quest/map-terrain.png',
    readMode: 'assets/rooms/router-quest/read-mode.png'
  },
  { // 4 Reel Trap — §15
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[19, 2], [20, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: 'reel',
    objects: [
      { id: 'reel-monster', type: 'monster', obj: [11, 6], at: [11, 7], sprite: 'monster', say: 'reel-encounter' }
    ],
    terrain: 'assets/rooms/reel-trap/map-terrain.png',
    readMode: 'assets/rooms/reel-trap/read-mode.png'
  },
  { // 5 Plan Armory — §16
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[19, 2], [20, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: 'quests',
    objects: [
      { id: 'quest-rack-1', type: 'rack', obj: [4, 4], at: [4, 5], sprite: 'armory-rack', dress: 'potion', say: 'quest-0' },
      { id: 'quest-rack-2', type: 'rack', obj: [9, 4], at: [9, 5], sprite: 'armory-rack', dress: 'potion', say: 'quest-1' },
      { id: 'quest-rack-3', type: 'rack', obj: [14, 4], at: [14, 5], sprite: 'armory-rack', dress: 'potion', say: 'quest-2' },
      { id: 'quest-rack-4', type: 'rack', obj: [19, 4], at: [19, 5], sprite: 'armory-rack', dress: 'potion', say: 'quest-3' },
      { id: 'quest-rack-5', type: 'rack', obj: [6, 10], at: [6, 11], sprite: 'armory-rack', dress: 'potion', say: 'quest-4' },
      { id: 'quest-rack-6', type: 'rack', obj: [12, 10], at: [12, 11], sprite: 'armory-rack', dress: 'potion', say: 'quest-5' },
      { id: 'quest-rack-7', type: 'rack', obj: [18, 10], at: [18, 11], sprite: 'armory-rack', dress: 'potion', say: 'quest-6' }
    ],
    terrain: 'assets/rooms/plan-armory/map-terrain.png',
    readMode: 'assets/rooms/plan-armory/read-mode.png'
  },  { // 6 Infographic Vault — §17
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[19, 2], [20, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: 'torches',
    objects: [
      { id: 'vault-torch-1', type: 'torch', obj: [4, 4], at: [4, 5], sprite: 'torch', say: 'habit-0' },
      { id: 'vault-torch-2', type: 'torch', obj: [8, 4], at: [8, 5], sprite: 'torch', say: 'habit-1' },
      { id: 'vault-torch-3', type: 'torch', obj: [12, 4], at: [12, 5], sprite: 'torch', say: 'habit-2' },
      { id: 'vault-torch-4', type: 'torch', obj: [16, 4], at: [16, 5], sprite: 'torch', say: 'habit-3' },
      { id: 'vault-torch-5', type: 'torch', obj: [20, 4], at: [20, 5], sprite: 'torch', say: 'habit-4' },
      { id: 'vault-benefits', type: 'archive', obj: [4, 10], at: [4, 11], sprite: 'archive-shelf', say: 'vault-benefits' },
      { id: 'vault-risks', type: 'archive', obj: [20, 10], at: [20, 11], sprite: 'skull', say: 'vault-risks' },
      { id: 'vault-pledge', type: 'pledge', obj: [12, 8], at: [12, 9], sprite: 'scroll', say: 'vault-pledge' }
    ],
    terrain: 'assets/rooms/infographic-vault/map-terrain.png',
    readMode: 'assets/rooms/infographic-vault/read-mode.png'
  },
  { // 7 Exit — §18
    spawn: [4, 14], spawnDir: 'up',
    exitCells: [[11, 2], [12, 2]],
    returnCells: [[4, 16], [5, 16]],
    local: 'stats',
    objects: [
      { id: 'exit/chest-01', type: 'chest', obj: [12, 6], at: [12, 7], sprite: 'chest', say: 'exit-chest' },
      { id: 'exit-marker', type: 'marker', obj: [13, 6], at: [13, 7], sprite: 'exit-marker', say: 'exit-stats' }
    ],
    terrain: 'assets/rooms/exit/map-terrain.png',
    readMode: 'assets/rooms/exit/read-mode.png'
  }
];

/* Reward-chest registry — §9: 10 analysis + 1 router + 1 exit = 12 max loot */
const LOOT_CHESTS = [
  'analysis-chamber/chest-01', 'analysis-chamber/chest-02', 'analysis-chamber/chest-03',
  'analysis-chamber/chest-04', 'analysis-chamber/chest-05', 'analysis-chamber/chest-06',
  'analysis-chamber/chest-07', 'analysis-chamber/chest-08', 'analysis-chamber/chest-09',
  'analysis-chamber/chest-10', 'router-quest/chest-01', 'exit/chest-01'
];